CREATE OR REPLACE VIEW terapia.v_horarios_disponibles_2_semanas AS
WITH
params AS (
    SELECT
        current_date AS d_ini,
        current_date + 13 AS d_fin,
        interval '50 minutes' AS slot_dur,
        'America/La_Paz'::text AS tz
),
fechas AS (
    SELECT gs::date AS fecha
    FROM params p,
    LATERAL generate_series(p.d_ini, p.d_fin, interval '1 day') AS gs
),
rangos_base AS (
    SELECT
        ht.id_horario_terapeuta,
        ht.id_usuario_terapeuta,
        f.fecha,
        ((f.fecha::timestamp + ht.hora_inicio) AT TIME ZONE (SELECT tz FROM params)) AS rango_inicio,
        ((f.fecha::timestamp + ht.hora_fin)    AT TIME ZONE (SELECT tz FROM params)) AS rango_fin,
        ht.tipo_atencion,
        ht.canal,
        ht.ubicacion,
        ht.metadata
    FROM terapia.horario_terapeuta ht
    JOIN fechas f
      ON ht.dia_semana = EXTRACT(ISODOW FROM f.fecha)::smallint
    WHERE ht.register_status = 'Activo'
      AND ht.es_laboral = true
),
slots AS (
    SELECT
        rb.id_usuario_terapeuta,
        rb.id_horario_terapeuta,
        rb.fecha,
        gs AS inicio,
        gs + (SELECT slot_dur FROM params) AS fin,
        (EXTRACT(EPOCH FROM (SELECT slot_dur FROM params)) / 60)::int AS duracion_minutos,
        rb.tipo_atencion,
        rb.canal,
        rb.ubicacion,
        rb.metadata
    FROM rangos_base rb,
    LATERAL generate_series(
        rb.rango_inicio,
        rb.rango_fin - (SELECT slot_dur FROM params),
        (SELECT slot_dur FROM params)
    ) AS gs
)
SELECT s.*
FROM slots s
WHERE s.fin > now()
  -- excluir bloqueos
  AND NOT EXISTS (
      SELECT 1
      FROM terapia.bloqueo_agenda b
      WHERE b.id_usuario_terapeuta = s.id_usuario_terapeuta
        AND b.register_status = 'Activo'
        AND tstzrange(b.inicio, b.fin, '[)') && tstzrange(s.inicio, s.fin, '[)')
  )
  -- excluir citas
  AND NOT EXISTS (
      SELECT 1
      FROM terapia.cita c
      WHERE c.id_usuario_terapeuta = s.id_usuario_terapeuta
        AND c.register_status = 'Activo'
        AND c.estado <> 'Cancelada'
        AND tstzrange(c.inicio, c.fin, '[)') && tstzrange(s.inicio, s.fin, '[)')
  );


CREATE OR REPLACE VIEW terapia.vw_resumen_solicitudes_cita AS
SELECT
    c.id_cita,
    c.estado,
    c.register_status,

    c.fecha_programada,
    c.inicio,
    c.fin,

    c.canal,
    c.enlace_sesion,
    c.direccion,

    c.id_usuario_paciente,
    up.email    AS paciente_email,
    up.nombre   AS paciente_nombre,
    up.apellido AS paciente_apellido,
    (up.nombre || ' ' || up.apellido) AS paciente_nombre_completo,

    c.id_usuario_terapeuta,
    ut.email    AS terapeuta_email,
    ut.nombre   AS terapeuta_nombre,
    ut.apellido AS terapeuta_apellido,
    (ut.nombre || ' ' || ut.apellido) AS terapeuta_nombre_completo,

    c.id_usuario_coordinador,
    uc.email    AS coordinador_email,
    uc.nombre   AS coordinador_nombre,
    uc.apellido AS coordinador_apellido,
    (uc.nombre || ' ' || uc.apellido) AS coordinador_nombre_completo,

    c.id_producto,
    pr.nombre           AS producto_nombre,
    pr.duracion_minutos AS producto_duracion_minutos,
    pr.precio_base      AS producto_precio_base,

    c.id_enfoque,
    ef.nombre           AS enfoque_nombre,

    c.id_transaccion,
    c.notas_internas,
    c.motivo_cancelacion,
    c.motivo_modificacion,

    c.created_at,
    c.updated_at
FROM terapia.cita c
JOIN usuarios.usuario up ON up.user_id = c.id_usuario_paciente
JOIN usuarios.usuario ut ON ut.user_id = c.id_usuario_terapeuta
LEFT JOIN usuarios.usuario uc ON uc.user_id = c.id_usuario_coordinador
JOIN terapia.producto pr ON pr.id_producto = c.id_producto
LEFT JOIN terapia.enfoque ef ON ef.id_enfoque = c.id_enfoque
WHERE c.register_status = 'Activo';


CREATE OR REPLACE VIEW usuarios.vw_admin_terapeuta_estado AS
SELECT
    a.user_id AS id_usuario_admin,
    (ua.nombre || ' ' || ua.apellido) AS admin_nombre_completo,
    ua.email AS admin_email,
    a.register_status AS admin_register_status,
    ua.estado_cuenta  AS admin_estado_cuenta,

    a.id_usuario_terapeuta AS id_usuario_terapeuta,

    (ut_u.nombre || ' ' || ut_u.apellido) AS terapeuta_nombre_completo,
    ut_u.email AS terapeuta_email,
    ut.register_status AS terapeuta_register_status,
    ut_u.estado_cuenta AS terapeuta_estado_cuenta

FROM usuarios.usuario_admin a
JOIN usuarios.usuario ua
  ON ua.user_id = a.user_id

LEFT JOIN usuarios.usuario_terapeuta ut
  ON ut.user_id = a.id_usuario_terapeuta

LEFT JOIN usuarios.usuario ut_u
  ON ut_u.user_id = ut.user_id;


/* ============================================================
   1) VIEW: Horarios + info completa del terapeuta
   ============================================================ */
CREATE OR REPLACE VIEW terapia.vw_horarios_terapeuta_full AS
SELECT
    h.id_horario_terapeuta,
    h.id_usuario_terapeuta,

    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    h.es_laboral,

    h.tipo_atencion,
    h.canal,
    h.ubicacion,
    h.metadata AS horario_metadata,

    h.created_at AS horario_created_at,
    h.updated_at AS horario_updated_at,
    h.register_status AS horario_register_status,

    -- Usuario base (terapeuta)
    u.email,
    u.telefono,
    u.nombre,
    u.apellido,
    (u.nombre || ' ' || u.apellido) AS nombre_completo,
    u.estado_cuenta,
    u.register_status AS usuario_register_status,

    -- Perfil terapeuta
    ut.titulo_profesional,
    ut.especialidad_principal,
    ut.descripcion_perfil,
    ut.frase_personal,
    ut.link_video_youtube,
    ut.matricula_profesional,
    ut.pais,
    ut.ciudad,
    ut.valor_sesion_base,
    ut.register_status AS terapeuta_register_status

FROM terapia.horario_terapeuta h
JOIN usuarios.usuario_terapeuta ut
  ON ut.user_id = h.id_usuario_terapeuta
JOIN usuarios.usuario u
  ON u.user_id = ut.user_id;
