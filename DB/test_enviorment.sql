
-----------------------------------------------------------------------------
--	 							WORKFLOW-1
-----------------------------------------------------------------------------

DO $$
DECLARE
    v_email      text := 'wf_paciente_8@example.com';
    v_password   text := 'Paciente123!';
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;
    v_user_id    integer;
    v_pin_code   text;
BEGIN
    RAISE NOTICE '=== WORKFLOW PACIENTE: signup -> login -> verify_pin ===';

    ------------------------------------------------------------------
    -- 1) SIGNUP PACIENTE (crea usuario + rol paciente + PIN)
    ------------------------------------------------------------------
    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_signup_paciente_with_verification_pin(
        p_email              => v_email,
        p_password           => v_password,
        p_nombre             => 'PacienteWF',
        p_apellido           => 'Prueba',
        p_telefono           => '70000001',
        p_sexo               => 'F',
        p_fecha_nacimiento   => '1995-01-01',

        p_pais               => 'Bolivia',
        p_ciudad             => 'Santa Cruz',
        p_ocupacion          => 'Estudiante',
        p_perfil_psicologico => jsonb_build_object('origen', 'wf_paciente'),

        p_pin_life_time      => '10 minutes',
        p_pin_contexto       => 'signup_paciente_workflow',
        p_pin_metadata       => jsonb_build_object('workflow', true)
    );

    RAISE NOTICE 'Signup paciente -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    v_user_id  := (v_data->>'user_id')::integer;
    v_pin_code := v_data->>'pin_code';

    RAISE NOTICE 'Signup paciente OK. user_id=%, pin_code=%', v_user_id, v_pin_code;

    ------------------------------------------------------------------
    -- 2) LOGIN ANTES DE VERIFICAR PIN (debería fallar: ACCOUNT_NOT_ACTIVE)
    ------------------------------------------------------------------
    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-paciente-before-pin',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login antes de verificar PIN -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    ------------------------------------------------------------------
    -- 3) VERIFY_PIN
    ------------------------------------------------------------------
    SELECT status, type_error, data
    INTO v_status, v_type_error, v_data
    FROM seguridad.fn_verificar_auth_pin(
        p_email    => v_email,
        p_tipo_pin => 'registro',
        p_pin_code => v_pin_code
    );

    RAISE NOTICE 'Verify PIN paciente -> status=%, type_error=%',
                 v_status, v_type_error;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 5) LOGIN DESPUÉS DE VERIFICAR PIN (debería ser OK, role=paciente)
    ------------------------------------------------------------------
    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-paciente-after-pin',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login después de verificar PIN -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status = 'ok' THEN
        RAISE NOTICE 'role=%, id_sesion=%', v_data->>'role', v_data->>'id_sesion';
    END IF;

    RAISE NOTICE '=== FIN WORKFLOW PACIENTE ===';
END;
$$;

select * from usuarios.usuario u;
select * from seguridad.auth_pin;
select * from seguridad.sesion s ;
select * from usuarios.usuario_paciente up ;


-----------------------------------------------------------------------------
--	 							WORKFLOW-2
-----------------------------------------------------------------------------
DO $$
DECLARE
    -- Correos de prueba
    v_email_terapeuta text := 'wf_terapeuta_6@example.com';
    v_email_admin     text := 'wf_admin_6@example.com';

    -- Misma pass para simplificar las pruebas
    v_password        text := 'Terapeuta123!';

    -- Variables de respuesta genérica
    v_status          text;
    v_type_error      text;
    v_message         text;
    v_data            jsonb;

    -- Terapeuta
    v_user_id_terapeuta integer;
    v_pin_terapeuta     text;
    v_id_sesion_terapeuta integer;

    -- Admin
    v_user_id_admin   integer;
    v_pin_admin       text;
    v_id_sesion_admin integer;
BEGIN
    RAISE NOTICE '=== WORKFLOW: REGISTRAR TERAPEUTA Y ADMIN ===';

    ------------------------------------------------------------------
    -- 1) SIGNUP TERAPEUTA (usuario + rol terapeuta + PIN)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 1) SIGNUP TERAPEUTA ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_signup_terapeuta_with_verification_pin(
        p_email                => v_email_terapeuta,
        p_password             => v_password,
        p_nombre               => 'TerapeutaWF',
        p_apellido             => 'Prueba',
        p_telefono             => '70000010',
        p_sexo                 => 'F',
        p_fecha_nacimiento     => '1990-05-10',

        p_titulo_profesional   => 'Psicóloga Clínica',
        p_especialidad_princ   => 'Terapia Cognitivo-Conductual',
        p_descripcion_perfil   => 'Terapeuta demo creada desde workflow.',
        p_frase_personal       => 'Cuidar la mente es cuidar la vida.',
        p_link_video_youtube   => NULL,
        p_matricula_profesional => 'MAT-WF-001',
        p_pais                 => 'Bolivia',
        p_ciudad               => 'Santa Cruz',
        p_valor_sesion_base    => 200.00,

        p_pin_life_time        => '10 minutes',
        p_pin_contexto         => 'signup_terapeuta_workflow',
        p_pin_metadata         => jsonb_build_object('workflow', true)
    );

    RAISE NOTICE 'Signup terapeuta -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    v_user_id_terapeuta := (v_data->>'user_id')::integer;
    v_pin_terapeuta     := v_data->>'pin_code';

    RAISE NOTICE 'Terapeuta creado: user_id=%, pin=%', v_user_id_terapeuta, v_pin_terapeuta;

    ------------------------------------------------------------------
    -- 2) LOGIN TERAPEUTA ANTES DE VERIFICAR PIN (debería fallar)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 2) LOGIN TERAPEUTA ANTES DE PIN ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email_terapeuta,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-terapeuta-before-pin',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login antes de verificar PIN (terapeuta) -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    ------------------------------------------------------------------
    -- 3) VERIFY PIN TERAPEUTA
    ------------------------------------------------------------------
    RAISE NOTICE '--- 3) VERIFY PIN TERAPEUTA ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM seguridad.fn_verificar_auth_pin(
        p_email    => v_email_terapeuta,
        p_tipo_pin => 'registro',
        p_pin_code => v_pin_terapeuta
    );

    RAISE NOTICE 'Verify PIN terapeuta -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) LOGIN TERAPEUTA DESPUÉS DE PIN
    ------------------------------------------------------------------
    RAISE NOTICE '--- 4) LOGIN TERAPEUTA DESPUÉS DE PIN ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email_terapeuta,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-terapeuta-after-pin',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login después de PIN (terapeuta) -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status = 'ok' THEN
        v_id_sesion_terapeuta := (v_data->>'id_sesion')::integer;
        RAISE NOTICE 'Terapeuta logged in -> role=%, id_sesion=%',
                     v_data->>'role', v_data->>'id_sesion';
    ELSE
        RAISE NOTICE 'Error en login de terapeuta. data=%', v_data;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 5) SIGNUP ADMIN ASOCIADO A ESTE TERAPEUTA
    ------------------------------------------------------------------
    RAISE NOTICE '--- 5) SIGNUP ADMIN ASOCIADO AL TERAPEUTA ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_signup_admin_with_verification_pin(
        p_email                => v_email_admin,
        p_password             => 'Admin123!',
        p_nombre               => 'AdminWF',
        p_apellido             => 'Prueba',
        p_telefono             => '70000011',
        p_sexo                 => 'M',
        p_fecha_nacimiento     => '1985-08-20',

        -- Asociamos este admin al terapeuta recién creado
        p_id_usuario_terapeuta => v_user_id_terapeuta,
        p_nivel                => 'full',
        p_is_super_admin       => true,
        p_can_manage_files     => true,
        p_is_accounter         => false,

        p_pin_life_time        => '10 minutes',
        p_pin_contexto         => 'signup_admin_workflow',
        p_pin_metadata         => jsonb_build_object(
                                      'workflow', true,
                                      'linked_terapeuta_user_id', v_user_id_terapeuta
                                  )
    );

    RAISE NOTICE 'Signup admin -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    v_user_id_admin := (v_data->>'user_id')::integer;

    RAISE NOTICE 'Admin creado: user_id=% (asociado a terapeuta user_id=%)',
                 v_user_id_admin, v_user_id_terapeuta;

    ------------------------------------------------------------------
    -- 6) LOGIN ADMIN ANTES DE VERIFICAR PIN (debería fallar)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 6) LOGIN ADMIN ANTES DE PIN ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email_admin,
        p_password   => 'Admin123!',
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-admin-before-pin',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login antes de verificar PIN (admin) -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    ------------------------------------------------------------------
    -- 7) VERIFY PIN ADMIN
    ------------------------------------------------------------------
    RAISE NOTICE '--- 7) VERIFY PIN ADMIN ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM seguridad.fn_verificar_auth_pin(
        p_email    => v_email_admin,
        p_tipo_pin => 'registro',
        p_pin_code => v_pin_admin
    );

    RAISE NOTICE 'Verify PIN admin -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 8) LOGIN ADMIN DESPUÉS DE PIN
    ------------------------------------------------------------------
    RAISE NOTICE '--- 8) LOGIN ADMIN DESPUÉS DE PIN ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email_admin,
        p_password   => 'Admin123!',
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-admin-after-pin',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login después de PIN (admin) -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status = 'ok' THEN
        v_id_sesion_admin := (v_data->>'id_sesion')::integer;
        RAISE NOTICE 'Admin logged in -> role=%, id_sesion=%',
                     v_data->>'role', v_data->>'id_sesion';
    ELSE
        RAISE NOTICE 'Error en login de admin. data=%', v_data;
        RETURN;
    END IF;

    RAISE NOTICE '=== FIN WORKFLOW TERAPEUTA + ADMIN ===';
END;
$$;

select * from seguridad.auth_pin;
select * from seguridad.sesion s ;
select * from usuarios.usuario u 
select * from usuarios.usuario_terapeuta ut;
select * from usuarios.usuario_admin ua;


-----------------------------------------------------------------------------
--	 							WORKFLOW-3
-----------------------------------------------------------------------------
DO $$
DECLARE
    ------------------------------------------------------------------
    -- Datos del admin ya existente
    ------------------------------------------------------------------
    v_email_admin     text := 'wf_admin_2@example.com';  
    v_password_admin  text := 'Admin123!';                   -- lo que dijiste
    v_admin_user_id   integer := 13;                             -- admin ya creado
    v_terapeuta_user_id integer := 12;                           -- terapeuta asociado

    ------------------------------------------------------------------
    -- Variables para respuestas
    ------------------------------------------------------------------
    v_status          text;
    v_type_error      text;
    v_message         text;
    v_data            jsonb;

    v_id_sesion       integer;
    v_id_enfoque      integer;
    v_id_producto     integer;
BEGIN
    RAISE NOTICE '=== WORKFLOW ADMIN: LOGIN -> CREAR ENFOQUE -> PRODUCTO -> HORARIO ===';

    ------------------------------------------------------------------
    -- 1) LOGIN ADMIN
    ------------------------------------------------------------------
    RAISE NOTICE '--- 1) LOGIN ADMIN ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email_admin,
        p_password   => v_password_admin,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-admin-creacion',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login admin -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'Login admin falló. data=%', v_data;
        RETURN;
    END IF;

    v_id_sesion := (v_data->>'id_sesion')::integer;

    RAISE NOTICE 'Admin logueado. user_id esperado=%, user_id devuelto=%, id_sesion=%',
                 v_admin_user_id,
                 v_data->>'user_id',
                 v_data->>'id_sesion';

    ------------------------------------------------------------------
    -- 2) CREAR ENFOQUE
    ------------------------------------------------------------------
    RAISE NOTICE '--- 2) CREAR ENFOQUE ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM terapia.fn_crear_enfoque(
        p_actor_user_id => v_admin_user_id,
        p_id_sesion     => v_id_sesion,
        p_nombre        => 'Terapia Cognitivo-Conductual Individual',
        p_descripcion   => 'Enfoque centrado en identificación y cambio de patrones de pensamiento y conducta.',
        p_metadata      => jsonb_build_object(
                              'workflow', true,
                              'creado_por', 'admin',
                              'nota', 'enfoque de prueba'
                           )
    );

    RAISE NOTICE 'Crear enfoque -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    v_id_enfoque := (v_data->>'id_enfoque')::integer;

    RAISE NOTICE 'Enfoque creado: id_enfoque=%', v_id_enfoque;

    ------------------------------------------------------------------
    -- 3) CREAR PRODUCTO (sesión) USANDO ESE ENFOQUE
    ------------------------------------------------------------------
    RAISE NOTICE '--- 3) CREAR PRODUCTO ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM terapia.fn_crear_producto(
        p_actor_user_id      => v_admin_user_id,
        p_id_sesion          => v_id_sesion,
        p_nombre             => 'Sesión individual 50 minutos',
        p_descripcion        => 'Sesión estándar 1:1 para adultos.',
        p_id_enfoque_default => v_id_enfoque,
        p_duracion_minutos   => 50,
        p_precio_base        => 200.00,
        p_costo_base         => 80.00,
        p_categoria          => 'individual',
        p_metadata           => jsonb_build_object(
                                   'workflow', true,
                                   'visible_en_web', true
                               )
    );

    RAISE NOTICE 'Crear producto -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    v_id_producto := (v_data->>'id_producto')::integer;

    RAISE NOTICE 'Producto creado: id_producto=% (id_enfoque_default=%)',
                 v_id_producto, v_id_enfoque;

    ------------------------------------------------------------------
    -- 4) CREAR HORARIO DEL TERAPEUTA ASOCIADO
    ------------------------------------------------------------------
    RAISE NOTICE '--- 4) CREAR HORARIO TERAPEUTA ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM terapia.fn_crear_horario_terapeuta(
        p_actor_user_id        => v_admin_user_id::integer,
        p_id_sesion            => v_id_sesion::integer,
        p_id_usuario_terapeuta => v_terapeuta_user_id::integer,
        p_dia_semana           => 2::smallint, -- 1=lunes, 2=martes, etc.
        p_hora_inicio          => '09:00'::time,
        p_hora_fin             => '12:00'::time,
        p_tipo_atencion        => 'online'::text,
        p_canal                => 'videollamada'::text,
        p_ubicacion            => 'Plataforma Corazón Migrante'::text,
        p_metadata             => jsonb_build_object(
                                     'workflow', true,
                                     'nota', 'bloque de prueba martes mañana'
                                 )::jsonb
    );

    RAISE NOTICE 'Crear horario terapeuta -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data = %', v_data;
        RETURN;
    END IF;

    RAISE NOTICE 'Horario terapeuta creado. data=%', v_data;

    RAISE NOTICE '=== FIN WORKFLOW ADMIN (user_id=%) ===', v_admin_user_id;
END;
$$;

select * from terapia.enfoque e;
select * from terapia.producto p; 
select * from terapia.horario_terapeuta ht;





-----------------------------------------------------------------------------
--	 							WORKFLOW-4
--              ADMIN: LOGIN (wf_admin_2@example.com) -> BLOQUEO AGENDA (terapeuta 12)
-----------------------------------------------------------------------------

DO $$
DECLARE
    ------------------------------------------------------------------
    -- Datos del admin ya existente
    ------------------------------------------------------------------
    v_email_admin       text    := 'wf_admin_2@example.com';
    v_password_admin    text    := 'Admin123!';
    v_admin_user_id     integer := 13;
    v_terapeuta_user_id integer := 12;

    ------------------------------------------------------------------
    -- Variables para respuestas
    ------------------------------------------------------------------
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;
    v_id_sesion  integer;

    ------------------------------------------------------------------
    -- Slot de bloqueo
    ------------------------------------------------------------------
    v_inicio timestamptz;
    v_fin    timestamptz;
    v_try    integer := 0;
BEGIN
    RAISE NOTICE '=== WORKFLOW-4 ADMIN: LOGIN -> BUSCAR SLOT LIBRE -> CREAR BLOQUEO ===';

    ------------------------------------------------------------------
    -- 1) LOGIN ADMIN
    ------------------------------------------------------------------
    RAISE NOTICE '--- 1) LOGIN ADMIN ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email_admin,
        p_password   => v_password_admin,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-admin-bloqueo',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login admin -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'Login admin falló. data=%', v_data;
        RETURN;
    END IF;

    v_id_sesion := (v_data->>'id_sesion')::integer;

    RAISE NOTICE 'Admin logueado. user_id esperado=%, user_id devuelto=%, id_sesion=%',
                 v_admin_user_id, v_data->>'user_id', v_data->>'id_sesion';

    ------------------------------------------------------------------
    -- 2) BUSCAR SLOT LIBRE (sin solape con citas ni bloqueos)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 2) BUSCAR SLOT LIBRE (terapeuta_user_id=%) ---', v_terapeuta_user_id;

    -- empezamos mañana 09:00, 60 minutos
    v_inicio := date_trunc('day', now()) + interval '1 day' + interval '9 hours';
    v_fin    := v_inicio + interval '60 minutes';

    LOOP
        v_try := v_try + 1;

        -- si nos pasamos de 17:00, saltamos al siguiente día 09:00
        IF v_inicio::time >= time '17:00' THEN
            v_inicio := date_trunc('day', v_inicio) + interval '1 day' + interval '9 hours';
            v_fin    := v_inicio + interval '60 minutes';
            CONTINUE;
        END IF;

        EXIT WHEN
            NOT EXISTS (
                SELECT 1
                FROM terapia.cita c
                WHERE c.id_usuario_terapeuta = v_terapeuta_user_id
                  AND c.register_status = 'Activo'
                  AND COALESCE(c.estado,'') NOT IN ('Cancelada','Cancelado')
                  AND c.inicio < v_fin
                  AND c.fin    > v_inicio
            )
            AND NOT EXISTS (
                SELECT 1
                FROM terapia.bloqueo_agenda b
                WHERE b.id_usuario_terapeuta = v_terapeuta_user_id
                  AND b.register_status = 'Activo'
                  AND b.inicio < v_fin
                  AND b.fin    > v_inicio
            );

        -- avanzar 1 hora y seguir buscando
        v_inicio := v_inicio + interval '60 minutes';
        v_fin    := v_inicio + interval '60 minutes';

        IF v_try > 200 THEN
            RAISE NOTICE 'No se encontró un slot libre en 200 intentos. Último intento: [% - %]', v_inicio, v_fin;
            RETURN;
        END IF;
    END LOOP;

    RAISE NOTICE 'Slot libre encontrado (intentos=%): inicio=% fin=%', v_try, v_inicio, v_fin;

    ------------------------------------------------------------------
    -- 3) CREAR BLOQUEO AGENDA
    ------------------------------------------------------------------
    RAISE NOTICE '--- 3) CREAR BLOQUEO AGENDA (terapeuta_user_id=%) ---', v_terapeuta_user_id;

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM terapia.fn_crear_bloqueo_agenda(
        p_actor_user_id        => v_admin_user_id,
        p_id_sesion            => v_id_sesion,
        p_id_usuario_terapeuta => v_terapeuta_user_id,
        p_inicio               => v_inicio,
        p_fin                  => v_fin,
        p_tipo_bloqueo         => 'bloqueo_manual',
        p_motivo               => 'Bloqueo de prueba creado desde WORKFLOW-4',
        p_metadata             => jsonb_build_object('workflow', true, 'workflow_id', 4)
    );

    RAISE NOTICE 'Crear bloqueo -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'Crear bloqueo falló. data=%', v_data;
        RETURN;
    END IF;

    RAISE NOTICE 'Bloqueo creado OK. data=%', v_data;

    RAISE NOTICE '=== FIN WORKFLOW-4 ===';
END;
$$;


select * from terapia.bloqueo_agenda ba ;
select * from usuarios.usuario ;
select * from usuarios.usuario_paciente;
select * from usuarios.usuario_terapeuta ut ;


/* -----------------------------------------------------------------------------
   WORKFLOW: login paciente -> obtener_horarios(user_id_terapeuta=12)
   (en DO, con pasos señalizados)
----------------------------------------------------------------------------- */
select * from terapia.horario_terapeuta ht 
select * from terapia.bloqueo_agenda
select * from terapia.obtener_horarios_disponibles_2_semanas(12);
select * from seguridad.action_log al ;










---------------


DO $$
DECLARE
    -- Credenciales
    v_email    text := 'wf_paciente_8@example.com';
    v_password text := 'Paciente123!';

    -- Respuesta genérica
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    -- Sesión / actor
    v_paciente_user_id integer;
    v_id_sesion        integer;

    -- Datos para la cita
    v_terapeuta_user_id integer := 12;
    v_id_producto       integer;
    v_inicio            timestamptz;
    v_fin               timestamptz;

    -- Para llamada dinámica a fn_registrar_cita
    v_argnames text[];
    v_sql      text;

    -- Verificación
    v_id_cita     integer;
    v_estado_cita text;
    v_logs_count  integer;
BEGIN
    RAISE NOTICE '=== WORKFLOW: LOGIN PACIENTE -> REGISTRAR CITA (PENDIENTE) ===';

    ------------------------------------------------------------------
    -- 1) LOGIN (paciente)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 1) LOGIN (paciente) ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-paciente-8-login',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_paciente_user_id := (v_data->>'user_id')::integer;
    v_id_sesion        := (v_data->>'id_sesion')::integer;

    RAISE NOTICE 'Login OK. paciente_user_id=%, id_sesion=%', v_paciente_user_id, v_id_sesion;

    ------------------------------------------------------------------
    -- 2) TOMAR id_producto (activo)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 2) OBTENER id_producto ---';

    SELECT p.id_producto
    INTO v_id_producto
    FROM terapia.producto p
    WHERE p.register_status = 'Activo'
    ORDER BY p.id_producto
    LIMIT 1;

    IF v_id_producto IS NULL THEN
        RAISE NOTICE 'No existe ningún producto activo en terapia.producto';
        RETURN;
    END IF;

    RAISE NOTICE 'Producto seleccionado: id_producto=%', v_id_producto;

    ------------------------------------------------------------------
    -- 3) TOMAR UN SLOT DISPONIBLE (si existe la función de 2 semanas)
    --    Si no devuelve nada, fallback a próximo martes 09:00-09:50
    ------------------------------------------------------------------
    RAISE NOTICE '--- 3) OBTENER SLOT DISPONIBLE ---';

    BEGIN
        SELECT h.inicio, h.fin
        INTO v_inicio, v_fin
        FROM terapia.fn_obtener_horarios_disponibles_2_semanas(v_terapeuta_user_id) h
        ORDER BY h.inicio
        LIMIT 1;
    EXCEPTION
        WHEN undefined_function THEN
            v_inicio := NULL;
            v_fin := NULL;
    END;

    IF v_inicio IS NULL OR v_fin IS NULL THEN
        -- fallback: próximo martes (dia_semana=2) 09:00-09:50
        DECLARE
            v_delta int;
            v_target_date date;
        BEGIN
            v_delta := (2 - EXTRACT(ISODOW FROM CURRENT_DATE)::int + 7) % 7;
            IF v_delta = 0 THEN v_delta := 7; END IF;
            v_target_date := CURRENT_DATE + v_delta;

            v_inicio := (v_target_date::timestamptz + time '09:00');
            v_fin    := (v_target_date::timestamptz + time '09:50');
        END;
    END IF;

    RAISE NOTICE 'Slot elegido: inicio=%, fin=%', v_inicio, v_fin;

    ------------------------------------------------------------------
    -- 4) REGISTRAR CITA (llamada dinámica para evitar error de params)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 4) REGISTRAR CITA (terapeuta_user_id=%) ---', v_terapeuta_user_id;

    SELECT p.proargnames
    INTO v_argnames
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'terapia'
      AND p.proname = 'fn_registrar_cita'
    ORDER BY p.oid DESC
    LIMIT 1;

    IF v_argnames IS NULL THEN
        RAISE NOTICE 'No se encontró terapia.fn_registrar_cita en el esquema terapia';
        RETURN;
    END IF;

    v_sql := 'SELECT status, type_error, message, data FROM terapia.fn_registrar_cita(';

    -- Sesión / actor
    IF 'p_actor_user_id' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_actor_user_id => %s,', v_paciente_user_id);
    END IF;

    IF 'p_id_sesion' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_id_sesion => %s,', v_id_sesion);
    END IF;

    -- Terapeuta / paciente
    IF 'p_id_usuario_terapeuta' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_id_usuario_terapeuta => %s,', v_terapeuta_user_id);
    END IF;

    IF 'p_id_usuario_paciente' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_id_usuario_paciente => %s,', v_paciente_user_id);
    END IF;

    -- Producto
    IF 'p_id_producto' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_id_producto => %s,', v_id_producto);
    END IF;

    -- Rango
    IF 'p_inicio' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_inicio => %L::timestamptz,', v_inicio);
    END IF;

    IF 'p_fin' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_fin => %L::timestamptz,', v_fin);
    END IF;

    -- Extras comunes
    IF 'p_canal' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_canal => %L,', 'online');
    END IF;

    IF 'p_enlace_sesion' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_enlace_sesion => %L,', NULL);
    END IF;

    IF 'p_direccion' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_direccion => %L,', NULL);
    END IF;

    IF 'p_notas_internas' = ANY(v_argnames) THEN
        v_sql := v_sql || format('p_notas_internas => %L,', 'WF test: registrar_cita paciente_8');
    END IF;

    IF 'p_metadata' = ANY(v_argnames) THEN
        v_sql := v_sql || format(
            'p_metadata => %L::jsonb,',
            jsonb_build_object('workflow', true, 'test', 'wf_paciente_8_registrar_cita')::text
        );
    END IF;

    -- cerrar llamada (quitando última coma si existe)
    v_sql := regexp_replace(v_sql, ',\s*$', '');
    v_sql := v_sql || ');';

    RAISE NOTICE 'SQL ejecutado: %', v_sql;

    EXECUTE v_sql
    INTO v_status, v_type_error, v_message, v_data;

    RAISE NOTICE 'Registrar cita -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_id_cita := NULLIF(v_data->>'id_cita','')::integer;

    RAISE NOTICE 'Cita creada: id_cita=%', v_id_cita;

    ------------------------------------------------------------------
    -- 5) VERIFICAR ESTADO = PENDIENTE
    ------------------------------------------------------------------
    RAISE NOTICE '--- 5) VERIFICAR ESTADO (Pendiente) ---';

    SELECT c.estado
    INTO v_estado_cita
    FROM terapia.cita c
    WHERE c.id_cita = v_id_cita;

    RAISE NOTICE 'Estado en terapia.cita: %', v_estado_cita;

    ------------------------------------------------------------------
    -- 6) VERIFICAR LOG (seguridad.action_log)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 6) VERIFICAR LOG (action_log) ---';

    SELECT COUNT(*)
    INTO v_logs_count
    FROM seguridad.action_log al
    WHERE al.id_sesion = v_id_sesion
      AND al.user_id   = v_paciente_user_id
      AND al.tipo_contenedor = 'cita'
      AND al.id_contenedor   = v_id_cita
      AND al.tipo_accion IN ('CREAR_CITA', 'REGISTRAR_CITA');

    RAISE NOTICE 'Logs encontrados para la cita: %', v_logs_count;

    RAISE NOTICE '=== FIN WORKFLOW ===';
END;
$$;


select * from terapia.cita;
select * from usuarios.usuario_admin ua;
select * from usuarios.usuario u;






DO $$
DECLARE
    -- Credenciales admin
    v_email      text := 'wf_admin_2@example.com';
    v_password   text := 'Admin123!';

    -- Respuestas genéricas
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    -- Sesión / actor
    v_admin_user_id integer;
    v_id_sesion     integer;

    -- Caso de prueba
    v_id_cita        integer := 1;          
    v_nuevo_estado   text    := 'Confirmada';
    v_motivo         text    := NULL;

    -- Verificación
    v_estado_cita     text;
    v_motivo_cancel   text;
    v_motivo_modif    text;
    v_logs            jsonb;
BEGIN
    RAISE NOTICE '=== WORKFLOW ADMIN: login -> fn_actualizar_estado_cita ===';

    ------------------------------------------------------------------
    -- 1) LOGIN ADMIN
    ------------------------------------------------------------------
    RAISE NOTICE '--- 1) LOGIN (admin) ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-admin-update-cita',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login admin -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'Login falló. data=%', v_data;
        RETURN;
    END IF;

    v_admin_user_id := (v_data->>'user_id')::integer;
    v_id_sesion     := (v_data->>'id_sesion')::integer;

    RAISE NOTICE 'Admin logged in -> user_id=%, id_sesion=%', v_admin_user_id, v_id_sesion;

    ------------------------------------------------------------------
    -- 2) ASEGURAR ID_CITA (fallback a 1 si 14 no existe)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 2) VALIDAR ID_CITA ---';

    IF NOT EXISTS (SELECT 1 FROM terapia.cita c WHERE c.id_cita = v_id_cita) THEN
        RAISE NOTICE 'id_cita=% no existe. Probando con id_cita=1...', v_id_cita;
        v_id_cita := 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM terapia.cita c WHERE c.id_cita = v_id_cita) THEN
        RAISE NOTICE 'No existe la cita (id_cita=%). Abortando.', v_id_cita;
        RETURN;
    END IF;

    RAISE NOTICE 'Usando id_cita=%', v_id_cita;

    ------------------------------------------------------------------
    -- 3) ACTUALIZAR ESTADO CITA (con fallback de firmas)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 3) ACTUALIZAR ESTADO CITA ---';

    BEGIN
        -- Firma “larga” (actor + sesion + cita + estado + motivo)
        SELECT status, type_error, message, data
        INTO v_status, v_type_error, v_message, v_data
        FROM terapia.fn_actualizar_estado_cita(
            p_actor_user_id => v_admin_user_id,
            p_id_sesion     => v_id_sesion,
            p_id_cita       => v_id_cita,
            p_nuevo_estado  => v_nuevo_estado,
            p_motivo        => v_motivo
        );

    EXCEPTION WHEN undefined_function THEN
        BEGIN
            -- (actor + cita + estado + motivo)
            SELECT status, type_error, message, data
            INTO v_status, v_type_error, v_message, v_data
            FROM terapia.fn_actualizar_estado_cita(
                p_actor_user_id => v_admin_user_id,
                p_id_cita       => v_id_cita,
                p_nuevo_estado  => v_nuevo_estado,
                p_motivo        => v_motivo
            );

        EXCEPTION WHEN undefined_function THEN
            BEGIN
                -- (sesion + cita + estado + motivo)
                SELECT status, type_error, message, data
                INTO v_status, v_type_error, v_message, v_data
                FROM terapia.fn_actualizar_estado_cita(
                    p_id_sesion    => v_id_sesion,
                    p_id_cita      => v_id_cita,
                    p_nuevo_estado => v_nuevo_estado,
                    p_motivo       => v_motivo
                );

            EXCEPTION WHEN undefined_function THEN
                BEGIN
                    -- Posicional (cita, estado, motivo)
                    SELECT status, type_error, message, data
                    INTO v_status, v_type_error, v_message, v_data
                    FROM terapia.fn_actualizar_estado_cita(
                        v_id_cita,
                        v_nuevo_estado,
                        v_motivo
                    );

                EXCEPTION WHEN undefined_function THEN
                    -- Posicional (cita, estado)
                    SELECT status, type_error, message, data
                    INTO v_status, v_type_error, v_message, v_data
                    FROM terapia.fn_actualizar_estado_cita(
                        v_id_cita,
                        v_nuevo_estado
                    );
                END;
            END;
        END;
    END;

    RAISE NOTICE 'Actualizar estado -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'Actualizar falló. data=%', v_data;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) VERIFICAR CITA + LOGS (action_log)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 4) VERIFICAR RESULTADO EN BD ---';

    SELECT c.estado, c.motivo_cancelacion, c.motivo_modificacion
    INTO v_estado_cita, v_motivo_cancel, v_motivo_modif
    FROM terapia.cita c
    WHERE c.id_cita = v_id_cita;

    RAISE NOTICE 'Cita id=% -> estado=%, motivo_cancelacion=%, motivo_modificacion=%',
                 v_id_cita, v_estado_cita, v_motivo_cancel, v_motivo_modif;

    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id_action',        al.id_action,
                'tipo_accion',      al.tipo_accion,
                'tipo_contenedor',  al.tipo_contenedor,
                'id_contenedor',    al.id_contenedor,
                'timestamp_accion', al.timestamp_accion,
                'detalles',         al.detalles
            )
            ORDER BY al.id_action
        ),
        '[]'::jsonb
    )
    INTO v_logs
    FROM seguridad.action_log al
    WHERE al.id_sesion       = v_id_sesion
      AND al.tipo_contenedor = 'cita'
      AND al.id_contenedor   = v_id_cita;

    RAISE NOTICE 'action_log (sesion=%, cita=%) = %', v_id_sesion, v_id_cita, v_logs;

    RAISE NOTICE '=== FIN WORKFLOW ADMIN ===';
END;
$$;

select * from terapia.cita;

-----------------------------------------------------------------------------
--                              WORKFLOW
--          ADMIN: LOGIN -> LISTAR SOLICITUDES DE CITA (por su terapeuta)
-----------------------------------------------------------------------------

DO $$
DECLARE
    ------------------------------------------------------------------
    -- Credenciales admin
    ------------------------------------------------------------------
    v_email      text := 'wf_admin_2@example.com';
    v_password   text := 'Admin123!';

    ------------------------------------------------------------------
    -- Variables login
    ------------------------------------------------------------------
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_admin_user_id integer;
    v_id_sesion     integer;

    ------------------------------------------------------------------
    -- Parámetros listado
    ------------------------------------------------------------------
    v_limit  integer := 20;
    v_offset integer := 0;

    ------------------------------------------------------------------
    -- Para mostrar resultados en NOTICE (opcional)
    ------------------------------------------------------------------
    v_row terapia.vw_resumen_solicitudes_cita%ROWTYPE;
    v_count integer := 0;
BEGIN
    RAISE NOTICE '=== WORKFLOW: ADMIN LOGIN -> LISTAR SOLICITUDES CITA ===';

    ------------------------------------------------------------------
    -- 1) LOGIN ADMIN
    ------------------------------------------------------------------
    RAISE NOTICE '--- 1) LOGIN ADMIN ---';

    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-admin-listar-solicitudes',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%',
                 v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'Login falló. data=%', v_data;
        RETURN;
    END IF;

    v_admin_user_id := (v_data->>'user_id')::integer;
    v_id_sesion     := (v_data->>'id_sesion')::integer;

    RAISE NOTICE 'Admin logueado. user_id=%, id_sesion=%',
                 v_admin_user_id, v_id_sesion;

    ------------------------------------------------------------------
    -- 2) LISTAR SOLICITUDES (filtradas por terapeuta del admin)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 2) LISTAR SOLICITUDES (limit=%, offset=%) ---', v_limit, v_offset;

    FOR v_row IN
        SELECT *
        FROM terapia.fn_listar_solicitudes_cita_admin(
            p_actor_user_id => v_admin_user_id,
            p_id_sesion     => v_id_sesion,
            p_limit         => v_limit,
            p_offset        => v_offset
        )
    LOOP
        v_count := v_count + 1;

        -- imprime un resumen compacto por fila
        RAISE NOTICE '#% | id_cita=% | estado=% | inicio=% | paciente=% | terapeuta=%',
            v_count,
            v_row.id_cita,
            v_row.estado,
            v_row.inicio,
            v_row.paciente_nombre_completo,
            v_row.terapeuta_nombre_completo;
    END LOOP;

    RAISE NOTICE 'Total filas retornadas: %', v_count;
    RAISE NOTICE '=== FIN WORKFLOW ===';
END;
$$;


DO $$
DECLARE
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_admin_user_id integer;
    v_id_sesion      integer;
BEGIN
    ------------------------------------------------------------------
    -- 1) LOGIN (admin)
    ------------------------------------------------------------------
    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => 'wf_admin_2@example.com',
        p_password   => 'Admin123!',
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'workflow-test',
        p_tipo_login => 'password'
    ) AS l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE EXCEPTION 'Login falló. data=%', v_data;
    END IF;

    v_admin_user_id := (v_data->>'user_id')::integer;
    v_id_sesion     := (v_data->>'id_sesion')::integer;

    ------------------------------------------------------------------
    -- 2) LISTAR TERAPEUTAS SIN ADMIN
    ------------------------------------------------------------------
    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_listar_terapeutas_sin_admin(
        p_actor_user_id => v_admin_user_id,
        p_id_sesion     => v_id_sesion,
        p_limit         => 50
    ) AS r;

    RAISE NOTICE 'Listar terapeutas sin admin -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    RAISE NOTICE 'data=%', v_data;

END 
$$;

/* ============================================================
   WORKFLOW TEST: login (admin) -> listar enfoques -> listar productos
   ============================================================ */
DO $$
DECLARE
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id  integer;
    v_id_sesion integer;

    r_enfoque  record;
    r_producto record;

    v_count integer;
BEGIN
    RAISE NOTICE '=== WF: LOGIN -> LISTAR ENFOQUES/PRODUCTOS ===';

    ------------------------------------------------------------------
    -- 1) LOGIN (admin)
    ------------------------------------------------------------------
    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => 'wf_admin_2@example.com',
        p_password   => 'Admin123!',
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-listar-enfoques-productos',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id  := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    RAISE NOTICE 'Login OK -> user_id=%, id_sesion=%', v_user_id, v_id_sesion;

    ------------------------------------------------------------------
    -- 2) LISTAR ENFOQUES
    ------------------------------------------------------------------
    RAISE NOTICE '--- LISTAR ENFOQUES ---';
    v_count := 0;

    FOR r_enfoque IN
        SELECT *
        FROM terapia.fn_listar_enfoques(
            p_actor_user_id => v_user_id,
            p_id_sesion     => v_id_sesion,
            p_limit         => 50,
            p_offset        => 0,
            p_only_activos  => true
        )
    LOOP
        v_count := v_count + 1;
        RAISE NOTICE '#% | id_enfoque=% | nombre=%', v_count, r_enfoque.id_enfoque, r_enfoque.nombre;
    END LOOP;

    RAISE NOTICE 'Enfoques retornados: %', v_count;

    ------------------------------------------------------------------
    -- 3) LISTAR PRODUCTOS
    ------------------------------------------------------------------
    RAISE NOTICE '--- LISTAR PRODUCTOS ---';
    v_count := 0;

    FOR r_producto IN
        SELECT *
        FROM terapia.fn_listar_productos(
            p_actor_user_id => v_user_id,
            p_id_sesion     => v_id_sesion,
            p_limit         => 50,
            p_offset        => 0,
            p_only_activos  => true
        )
    LOOP
        v_count := v_count + 1;
        RAISE NOTICE '#% | id_producto=% | nombre=% | dur=% | precio=% | enfoque=%',
            v_count,
            r_producto.id_producto,
            r_producto.nombre,
            r_producto.duracion_minutos,
            r_producto.precio_base,
            r_producto.enfoque_default_nombre;
    END LOOP;

    RAISE NOTICE 'Productos retornados: %', v_count;

    RAISE NOTICE '=== FIN WF ===';
END $$;



/* ============================================================
   WORKFLOW TEST: login (admin) -> listar grupos_cuenta -> listar cuentas
   ============================================================ */
DO $$
DECLARE
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id   integer;
    v_id_sesion integer;

    r_gc record;
    r_c  record;

    v_count integer;
BEGIN
    RAISE NOTICE '=== WF: LOGIN -> LISTAR GRUPO_CUENTA / CUENTA ===';

    ------------------------------------------------------------------
    -- 1) LOGIN (admin)
    ------------------------------------------------------------------
    SELECT status, type_error, message, data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => 'wf_admin_2@example.com',
        p_password   => 'Admin123!',
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-listar-cuentas',
        p_tipo_login => 'password'
    );

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    RAISE NOTICE 'Login OK -> user_id=%, id_sesion=%', v_user_id, v_id_sesion;

    ------------------------------------------------------------------
    -- 2) LISTAR GRUPOS CUENTA
    ------------------------------------------------------------------
    RAISE NOTICE '--- LISTAR GRUPOS CUENTA ---';
    v_count := 0;

    FOR r_gc IN
        SELECT *
        FROM contabilidad.fn_listar_grupos_cuenta(
            p_actor_user_id => v_user_id,
            p_id_sesion     => v_id_sesion,
            p_limit         => 50,
            p_offset        => 0,
            p_only_activos  => true
        )
    LOOP
        v_count := v_count + 1;
        RAISE NOTICE '#% | id_grupo=% | codigo=% | nombre=% | padre=%',
            v_count, r_gc.id_grupo_cuenta, r_gc.codigo, r_gc.nombre, r_gc.grupo_padre_nombre;
    END LOOP;

    RAISE NOTICE 'Grupos retornados: %', v_count;

    ------------------------------------------------------------------
    -- 3) LISTAR CUENTAS
    ------------------------------------------------------------------
    RAISE NOTICE '--- LISTAR CUENTAS ---';
    v_count := 0;

    FOR r_c IN
        SELECT *
        FROM contabilidad.fn_listar_cuentas(
            p_actor_user_id   => v_user_id,
            p_id_sesion       => v_id_sesion,
            p_limit           => 50,
            p_offset          => 0,
            p_only_activos    => true,
            p_id_grupo_cuenta => NULL
        )
    LOOP
        v_count := v_count + 1;
        RAISE NOTICE '#% | id_cuenta=% | codigo=% | nombre=% | grupo=%',
            v_count, r_c.id_cuenta, r_c.codigo, r_c.nombre, r_c.grupo_cuenta_nombre;
    END LOOP;

    RAISE NOTICE 'Cuentas retornadas: %', v_count;

    RAISE NOTICE '=== FIN WF ===';
END $$;




/* ============================================================
   WORKFLOW TEST COMPLETO:
   fn_signup_admin_with_verification_pin -> verify_pin -> login
   -> registrar_grupo_cuenta -> registrar_cuenta (2) -> registrar_transaccion
   ============================================================ */
DO $$
DECLARE
    -- credenciales (email único por ejecución)
    v_email text := 'wf_contador_' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS') || '@example.com';
    v_password text := 'Admin123!';

    -- signup/verify/login
    v_status text; v_type_error text; v_message text; v_data jsonb;
    v_pin_code text;

    v_user_id integer;
    v_id_sesion integer;

    -- contabilidad
    v_codigo_gc_activo text := 'WF-ACT-' || left(md5(random()::text),6);
    v_codigo_gc_ing    text := 'WF-ING-' || left(md5(random()::text),6);

    v_id_gc_activo integer;
    v_id_gc_ing    integer;

    v_codigo_caja text := 'WF-CAJ-' || left(md5(random()::text),6);
    v_codigo_ing  text := 'WF-REV-' || left(md5(random()::text),6);

    v_id_cuenta_caja integer;
    v_id_cuenta_ing  integer;

    v_id_transaccion integer;

BEGIN
    RAISE NOTICE '=== WF CONTADOR: SIGNUP -> VERIFY -> LOGIN -> CONTABILIDAD ===';
    RAISE NOTICE 'Email contador: %', v_email;

    ------------------------------------------------------------------
    -- 1) SIGNUP ADMIN (contador)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 1) SIGNUP ADMIN (is_accounter=true) ---';

    SELECT s.status, s.type_error, s.message, s.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_signup_admin_with_verification_pin(
        p_email            => v_email,
        p_password         => v_password,
        p_nombre           => 'WF',
        p_apellido         => 'Contador',
        p_telefono         => NULL,
        p_sexo             => NULL,
        p_fecha_nacimiento => NULL,

        p_id_usuario_terapeuta => NULL,
        p_nivel                => 'admin_sistema',
        p_is_super_admin       => false,
        p_can_manage_files     => false,
        p_is_accounter         => true,

        p_pin_life_time        => interval '10 minutes',
        p_pin_contexto         => 'signup_admin',
        p_pin_metadata         => jsonb_build_object('workflow','wf_contador')
    ) s;

    RAISE NOTICE 'Signup -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id  := (v_data->>'user_id')::int;
    v_pin_code := (v_data->>'pin_code');

    RAISE NOTICE 'Signup OK -> user_id=%, pin_code=%', v_user_id, v_pin_code;

    ------------------------------------------------------------------
    -- 2) VERIFY PIN (activar cuenta)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 2) VERIFY PIN ---';

    SELECT v.status, v.type_error, v.message, v.data
    INTO v_status, v_type_error, v_message, v_data
    FROM seguridad.fn_verificar_auth_pin(
        p_email    => v_email,
        p_tipo_pin => 'registro',
        p_pin_code => v_pin_code
    ) v;

    RAISE NOTICE 'Verify -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) LOGIN
    ------------------------------------------------------------------
    RAISE NOTICE '--- 3) LOGIN ---';

    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-contador-login',
        p_tipo_login => 'password'
    ) l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    RAISE NOTICE 'Login OK -> user_id=%, id_sesion=%', v_user_id, v_id_sesion;

    ------------------------------------------------------------------
    -- 4) REGISTRAR GRUPOS CUENTA (Activo / Ingreso)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 4) REGISTRAR GRUPO CUENTA (Activo) ---';

    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM contabilidad.fn_registrar_grupo_cuenta(
        p_actor_user_id  => v_user_id,
        p_id_sesion      => v_id_sesion,
        p_nombre         => 'WF Activos',
        p_codigo         => v_codigo_gc_activo,
        p_id_grupo_padre => NULL,
        p_tipo_grupo     => 'Activo',
        p_metadata       => jsonb_build_object('wf',true)
    ) r;

    RAISE NOTICE 'Grupo Activo -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN RAISE NOTICE 'data=%', v_data; RETURN; END IF;
    v_id_gc_activo := (v_data->>'id_grupo_cuenta')::int;

    RAISE NOTICE '--- 4.2) REGISTRAR GRUPO CUENTA (Ingreso) ---';

    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM contabilidad.fn_registrar_grupo_cuenta(
        p_actor_user_id  => v_user_id,
        p_id_sesion      => v_id_sesion,
        p_nombre         => 'WF Ingresos',
        p_codigo         => v_codigo_gc_ing,
        p_id_grupo_padre => NULL,
        p_tipo_grupo     => 'Ingreso',
        p_metadata       => jsonb_build_object('wf',true)
    ) r;

    RAISE NOTICE 'Grupo Ingreso -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN RAISE NOTICE 'data=%', v_data; RETURN; END IF;
    v_id_gc_ing := (v_data->>'id_grupo_cuenta')::int;

    ------------------------------------------------------------------
    -- 5) REGISTRAR CUENTAS (Caja / Ingreso)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 5) REGISTRAR CUENTA (Caja) ---';

    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM contabilidad.fn_registrar_cuenta(
        p_actor_user_id   => v_user_id,
        p_id_sesion       => v_id_sesion,
        p_nombre          => 'WF Caja',
        p_codigo          => v_codigo_caja,
        p_id_grupo_cuenta => v_id_gc_activo,
        p_tipo_cuenta     => 'Balance',
        p_sub_tipo        => 'Activo',
        p_categoria       => 'Caja',
        p_moneda          => 'BOB',
        p_metadata        => jsonb_build_object('wf',true)
    ) r;

    RAISE NOTICE 'Cuenta Caja -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN RAISE NOTICE 'data=%', v_data; RETURN; END IF;
    v_id_cuenta_caja := (v_data->>'id_cuenta')::int;

    RAISE NOTICE '--- 5.2) REGISTRAR CUENTA (Ingreso) ---';

    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM contabilidad.fn_registrar_cuenta(
        p_actor_user_id   => v_user_id,
        p_id_sesion       => v_id_sesion,
        p_nombre          => 'WF Ingreso Servicios',
        p_id_grupo_cuenta => v_id_gc_ing,
        p_codigo          => v_codigo_ing,
        p_tipo_cuenta     => 'Resultado',
        p_sub_tipo        => 'Ingresos',
        p_categoria       => 'Servicios',
        p_moneda          => 'BOB',
        p_metadata        => jsonb_build_object('wf',true)
    ) r;

    RAISE NOTICE 'Cuenta Ingreso -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN RAISE NOTICE 'data=%', v_data; RETURN; END IF;
    v_id_cuenta_ing := (v_data->>'id_cuenta')::int;

    ------------------------------------------------------------------
    -- 6) REGISTRAR TRANSACCIÓN (asiento mínimo 2 líneas)
    ------------------------------------------------------------------
    RAISE NOTICE '--- 6) REGISTRAR TRANSACCION ---';

    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM contabilidad.fn_registrar_transaccion(
        p_actor_user_id      => v_user_id,
        p_id_sesion          => v_id_sesion,
        p_fecha              => CURRENT_DATE,
        p_tipo_transaccion   => 'Ingreso',
        p_glosa              => 'WF Asiento de prueba',
        p_referencia_externa => 'wf:asiento',
        p_metadata           => jsonb_build_object('wf',true),
        p_movimientos        => jsonb_build_array(
            jsonb_build_object('id_cuenta', v_id_cuenta_caja, 'debe', 100, 'haber', 0,   'descripcion','Ingreso a caja WF'),
            jsonb_build_object('id_cuenta', v_id_cuenta_ing,  'debe', 0,   'haber', 100, 'descripcion','Reconocimiento ingreso WF')
        )
    ) r;

    RAISE NOTICE 'Transaccion -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN RAISE NOTICE 'data=%', v_data; RETURN; END IF;

    v_id_transaccion := (v_data->>'id_transaccion')::int;
    RAISE NOTICE 'OK -> id_transaccion=%', v_id_transaccion;

    RAISE NOTICE '=== FIN WF ===';
END $$;



/* ============================================================
   WORKFLOW TEST: registrar visita pública
   ============================================================ */
DO $$
DECLARE
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;
BEGIN
    RAISE NOTICE '=== WF: REGISTRAR VISITA PUBLICA ===';

    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM seguridad.fn_registrar_visita_publica(
        p_ip_acceso         => '127.0.0.1'::inet,
        p_user_agent        => 'Mozilla/5.0 (WF Test)',
        p_metodo_http       => 'GET',
        p_path              => '/home',
        p_query_string      => 'utm_source=wf_test&utm_medium=sql',
        p_referrer          => 'https://google.com',
        p_session_public_id => 'pub_' || left(md5(random()::text), 10),
        p_pais              => 'BO',
        p_device_type       => 'desktop',
        p_metadata          => jsonb_build_object('wf', true, 'feature', 'visita_publica')
    ) r;

    RAISE NOTICE 'Result -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    RAISE NOTICE 'data=%', v_data;

    RAISE NOTICE '=== FIN WF ===';
END $$;

/* ============================================================
   WORKFLOW TEST: registrar varios ui_event en una sola llamada
   ============================================================ */

DO $$
DECLARE
    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_session_public_id text := 'pub_' || left(md5(random()::text), 12);
BEGIN
    RAISE NOTICE '=== WF: UI_EVENT BULK ===';
    RAISE NOTICE 'session_public_id=%', v_session_public_id;

    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM analytics.fn_registrar_ui_events_bulk(
        p_session_public_id => v_session_public_id,
        p_user_id           => NULL,
        p_events            => jsonb_build_array(
            jsonb_build_object(
                'event_type','view',
                'element_key','page_home',
                'element_value',NULL,
                'page_path','/home',
                'metadata', jsonb_build_object('utm_source','wf_test')
            ),
            jsonb_build_object(
                'event_type','click',
                'element_key','card_terapeuta',
                'element_value','12',
                'page_path','/search',
                'metadata', jsonb_build_object('position', 3)
            ),
            jsonb_build_object(
                'event_type','select',
                'element_key','filtro_enfoque',
                'element_value','TCC',
                'page_path','/search',
                'metadata', jsonb_build_object('label','CBT')
            )
        )
    ) r;

    RAISE NOTICE 'Result -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    RAISE NOTICE 'data=%', v_data;

    RAISE NOTICE '=== FIN WF ===';
END 
$$;


-----------------------------------------------------------------------------
-- WORKFLOW (USUARIO LOGEADO): LOGIN -> REGISTRAR UI EVENTS (BULK)
-----------------------------------------------------------------------------

DO $$
DECLARE
    -- Login (usa un usuario existente)
    v_email      text := 'wf_paciente_8@example.com';
    v_password   text := 'Paciente123!';

    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id    integer;
    v_id_sesion  integer;

    -- UI tracking
    v_session_public_id text := 'pub_' || left(md5(random()::text), 12);

BEGIN
    RAISE NOTICE '=== WF: LOGIN -> UI_EVENT BULK (LOGUEADO) ===';

    -------------------------------------------------------------------------
    -- 1) LOGIN
    -------------------------------------------------------------------------
    RAISE NOTICE '--- 1) LOGIN ---';

    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-ui-event-logged',
        p_tipo_login => 'password'
    ) l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'Login falló. data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    RAISE NOTICE 'Login OK -> user_id=%, id_sesion=%, session_public_id=%',
                 v_user_id, v_id_sesion, v_session_public_id;

    -------------------------------------------------------------------------
    -- 2) REGISTRAR EVENTOS UI (bulk)
    -------------------------------------------------------------------------
    RAISE NOTICE '--- 2) REGISTRAR UI EVENTS (bulk) ---';

    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM analytics.fn_registrar_ui_events_bulk(
        p_session_public_id => v_session_public_id,
        p_user_id           => v_user_id,
        p_events            => jsonb_build_array(
            jsonb_build_object(
                'event_type',    'view'::text,
                'element_key',   'page_home'::text,
                'element_value', NULL,
                'page_path',     '/home'::text,
                'metadata',      jsonb_build_object('id_sesion', v_id_sesion, 'wf', true)
            ),
            jsonb_build_object(
                'event_type',    'click'::text,
                'element_key',   'card_terapeuta'::text,
                'element_value', '12'::text,
                'page_path',     '/search'::text,
                'metadata',      jsonb_build_object('position', 2, 'id_sesion', v_id_sesion)
            ),
            jsonb_build_object(
                'event_type',    'click'::text,
                'element_key',   'btn_reservar'::text,
                'element_value', 'start'::text,
                'page_path',     '/terapeuta/12'::text,
                'metadata',      jsonb_build_object('id_sesion', v_id_sesion)
            )
        )
    ) r;

    RAISE NOTICE 'UI bulk -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    RAISE NOTICE 'data=%', v_data;

    RAISE NOTICE '=== FIN WF ===';
END $$;


DO $$
DECLARE
    v_email    text := 'wf_paciente_7@example.com';
    v_password text := 'Paciente123!';

    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id   integer;
    v_id_sesion integer;

    v_id_terapeuta integer := 12;

    r record;
    v_count int := 0;
BEGIN
    RAISE NOTICE '=== WF: PACIENTE LOGIN -> OBTENER HORARIOS TERAPEUTA ===';

    ------------------------------------------------------------------
    -- 1) LOGIN
    ------------------------------------------------------------------
    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-paciente-horarios',
        p_tipo_login => 'password'
    ) l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;

    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    ------------------------------------------------------------------
    -- 2) OBTENER HORARIOS
    ------------------------------------------------------------------
    FOR r IN
        SELECT *
        FROM terapia.fn_obtener_horarios_terapeuta(
            p_actor_user_id        => v_user_id,
            p_id_sesion            => v_id_sesion,
            p_id_usuario_terapeuta => v_id_terapeuta,
            p_only_activos         => true,
            p_limit                => 50,
            p_offset               => 0
        )
    LOOP
        v_count := v_count + 1;
        RAISE NOTICE '#% | terapeuta=% | dia=% | %-% | canal=% | ubicacion=%',
            v_count,
            r.nombre_completo,
            r.dia_semana,
            r.hora_inicio,
            r.hora_fin,
            r.canal,
            r.ubicacion;
    END LOOP;

    RAISE NOTICE 'Total horarios retornados: %', v_count;
    RAISE NOTICE '=== FIN WF ===';
END $$;



/* =============================================================================
   WORKFLOW A: TERAPEUTA -> login -> update usuario (self) -> update usuario_terapeuta (self)
   ============================================================================= */
DO $$
DECLARE
    v_email    text := 'wf_terapeuta_2@example.com';
    v_password text := 'Terapeuta123!';

    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id   integer;
    v_id_sesion integer;
BEGIN
    RAISE NOTICE '=== WF A: TERAPEUTA ===';

    -------------------------------------------------------------------------
    -- 1) LOGIN TERAPEUTA
    -------------------------------------------------------------------------
    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-terapeuta-update',
        p_tipo_login => 'password'
    ) l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    -------------------------------------------------------------------------
    -- 2) UPDATE usuarios.usuario (self)
    -------------------------------------------------------------------------
    SELECT u.status, u.type_error, u.message, u.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_update_usuario(
        p_actor_user_id => v_user_id,
        p_id_sesion     => v_id_sesion,
        p_user_id       => v_user_id,
        p_patch         => jsonb_build_object(
            'telefono', '70000099',
            'foto_perfil_link', 'https://cdn.example.com/profile/terapeuta.png'
        )
    ) u;

    RAISE NOTICE 'Update usuario -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;

    -------------------------------------------------------------------------
    -- 3) UPDATE usuarios.usuario_terapeuta (self)
    -------------------------------------------------------------------------
    SELECT t.status, t.type_error, t.message, t.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_update_usuario_terapeuta(
        p_actor_user_id => v_user_id,
        p_id_sesion     => v_id_sesion,
        p_user_id       => v_user_id,
        p_patch         => jsonb_build_object(
            'frase_personal', 'WF: frase actualizada desde workflow',
            'ciudad', 'Santa Cruz',
            'valor_sesion_base', 120
        )
    ) t;

    RAISE NOTICE 'Update terapeuta -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;

    RAISE NOTICE '=== FIN WF A ===';
END $$;

/* =============================================================================
   WORKFLOW B: ADMIN -> login -> update enfoque -> update producto
   (toma el primer enfoque/producto activo para no hardcodear IDs)
   ============================================================================= */
DO $$
DECLARE
    v_email    text := 'wf_admin_2@example.com';
    v_password text := 'Admin123!';

    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id   integer;
    v_id_sesion integer;

    v_id_enfoque  integer;
    v_id_producto integer;
BEGIN
    RAISE NOTICE '=== WF B: ADMIN ===';

    -------------------------------------------------------------------------
    -- 1) LOGIN ADMIN
    -------------------------------------------------------------------------
    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-admin-update',
        p_tipo_login => 'password'
    ) l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    -------------------------------------------------------------------------
    -- 2) Elegir enfoque activo
    -------------------------------------------------------------------------
    SELECT e.id_enfoque
    INTO v_id_enfoque
    FROM terapia.enfoque e
    WHERE e.register_status = 'Activo'
    ORDER BY e.id_enfoque
    LIMIT 1;

    IF v_id_enfoque IS NULL THEN
        RAISE NOTICE 'No hay enfoques activos. (Nada que actualizar)';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- 3) UPDATE enfoque
    -------------------------------------------------------------------------
    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM terapia.fn_update_enfoque(
        p_actor_user_id => v_user_id,
        p_id_sesion     => v_id_sesion,
        p_id_enfoque    => v_id_enfoque,
        p_patch         => jsonb_build_object(
            'descripcion', 'WF: descripción actualizada por admin',
            'metadata', jsonb_build_object('wf', true, 'updated_at', now())
        )
    ) r;

    RAISE NOTICE 'Update enfoque(id=%) -> status=%, type_error=%, message=%',
        v_id_enfoque, v_status, v_type_error, v_message;

    -------------------------------------------------------------------------
    -- 4) Elegir producto activo
    -------------------------------------------------------------------------
    SELECT p.id_producto
    INTO v_id_producto
    FROM terapia.producto p
    WHERE p.register_status = 'Activo'
    ORDER BY p.id_producto
    LIMIT 1;

    IF v_id_producto IS NULL THEN
        RAISE NOTICE 'No hay productos activos. (Nada que actualizar)';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- 5) UPDATE producto
    -------------------------------------------------------------------------
    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM terapia.fn_update_producto(
        p_actor_user_id => v_user_id,
        p_id_sesion     => v_id_sesion,
        p_id_producto   => v_id_producto,
        p_patch         => jsonb_build_object(
            'precio_base', 150,
            'categoria', 'WF_CAT',
            'metadata', jsonb_build_object('wf', true, 'note', 'admin update')
        )
    ) r;

    RAISE NOTICE 'Update producto(id=%) -> status=%, type_error=%, message=%',
        v_id_producto, v_status, v_type_error, v_message;

    RAISE NOTICE '=== FIN WF B ===';
END $$;


/* ============================================================
   WORKFLOW TEST: PACIENTE login -> fn_update_paciente_full (self)
   ============================================================ */
DO $$
DECLARE
    v_email    text := 'wf_paciente_7@example.com';
    v_password text := 'Paciente123!';

    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id   integer;
    v_id_sesion integer;
BEGIN
    RAISE NOTICE '=== WF: PACIENTE LOGIN -> UPDATE_PACIENTE_FULL ===';

    -- 1) LOGIN
    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-update-paciente-full',
        p_tipo_login => 'password'
    ) l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    -- 2) UPDATE FULL (padre + hija)
    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_update_paciente_full(
        p_actor_user_id => v_user_id,
        p_id_sesion     => v_id_sesion,
        p_user_id       => v_user_id,
        p_patch         => jsonb_build_object(
            'telefono', '70000222',
            'nombre', 'WF Paciente Updated',
            'ocupacion', 'Estudiante',
            'notas_internas', 'WF: update full',
            'perfil_psicologico', jsonb_build_object('wf', true, 'ansiedad', 'leve')
        )
    ) r;

    RAISE NOTICE 'UpdateFull -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    RAISE NOTICE 'data=%', v_data;

    RAISE NOTICE '=== FIN WF ===';
END $$;


/* ============================================================
   WORKFLOW TEST: TERAPEUTA login -> fn_update_terapeuta_full (self)
   ============================================================ */
DO $$
DECLARE
    v_email    text := 'wf_terapeuta_2@example.com';
    v_password text := 'Terapeuta123!';

    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id   integer;
    v_id_sesion integer;
BEGIN
    RAISE NOTICE '=== WF: TERAPEUTA LOGIN -> UPDATE_TERAPEUTA_FULL ===';

    -- 1) LOGIN
    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-update-terapeuta-full',
        p_tipo_login => 'password'
    ) l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    -- 2) UPDATE FULL (padre + hija)
    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_update_terapeuta_full(
        p_actor_user_id => v_user_id,
        p_id_sesion     => v_id_sesion,
        p_user_id       => v_user_id,
        p_patch         => jsonb_build_object(
            'telefono', '70000333',
            'foto_perfil_link', 'https://cdn.example.com/profile/terapeuta.png',
            'frase_personal', 'WF: frase actualizada (full)',
            'ciudad', 'Santa Cruz',
            'valor_sesion_base', 130
        )
    ) r;

    RAISE NOTICE 'UpdateFull -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    RAISE NOTICE 'data=%', v_data;

    RAISE NOTICE '=== FIN WF ===';
END $$;



/* =============================================================================
   WF 1) ADMIN -> login -> seleccionar cita (de su terapeuta) -> fn_actualizar_estado_cita
   Requisitos:
   - El admin gestiona a 1 terapeuta (usuario_admin.id_usuario_terapeuta)
   - La cita debe estar Activa, NO Cancelada, estado en (Pendiente/Planificada)
   - inicio > now() + 2 días (para pasar regla “1 día antes”)
   ============================================================================= */
DO $$
DECLARE
    v_email    text := 'wf_admin_2@example.com';
    v_password text := 'Admin123!';

    v_status     text;
    v_type_error text;
    v_message    text;
    v_data       jsonb;

    v_user_id    integer;
    v_id_sesion  integer;

    v_admin_terapeuta integer;

    v_id_cita integer;
    v_estado  text;
BEGIN
    RAISE NOTICE '=== WF1: ADMIN -> ACTUALIZAR ESTADO CITA ===';

    -------------------------------------------------------------------------
    -- 1) LOGIN
    -------------------------------------------------------------------------
    SELECT l.status, l.type_error, l.message, l.data
    INTO v_status, v_type_error, v_message, v_data
    FROM usuarios.fn_login_password(
        p_email      => v_email,
        p_password   => v_password,
        p_ip_acceso  => '127.0.0.1',
        p_user_agent => 'wf-admin-actualizar-estado-cita',
        p_tipo_login => 'password'
    ) l;

    RAISE NOTICE 'Login -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    IF v_status <> 'ok' THEN
        RAISE NOTICE 'data=%', v_data;
        RETURN;
    END IF;

    v_user_id   := (v_data->>'user_id')::int;
    v_id_sesion := (v_data->>'id_sesion')::int;

    -------------------------------------------------------------------------
    -- 2) OBTENER terapeuta asignado al admin
    -------------------------------------------------------------------------
    SELECT a.id_usuario_terapeuta
    INTO v_admin_terapeuta
    FROM usuarios.usuario_admin a
    WHERE a.user_id = v_user_id
      AND a.register_status = 'Activo';

    IF v_admin_terapeuta IS NULL THEN
        RAISE NOTICE 'Admin no tiene terapeuta asignado (id_usuario_terapeuta=NULL). No se puede continuar.';
        RETURN;
    END IF;

    -------------------------------------------------------------------------
    -- 3) ELEGIR CITA CANDIDATA (del terapeuta del admin, editable por regla 1 día)
    -------------------------------------------------------------------------
    SELECT c.id_cita, c.estado
    INTO v_id_cita, v_estado
    FROM terapia.cita c
    WHERE c.register_status = 'Activo'
      AND c.id_usuario_terapeuta = v_admin_terapeuta
    LIMIT 1;

    IF v_id_cita IS NULL THEN
        RAISE NOTICE 'No encontré una cita candidata (Pendiente/Planificada) > 2 días para el terapeuta %', v_admin_terapeuta;
        RETURN;
    END IF;

    RAISE NOTICE 'Cita seleccionada -> id_cita=%, estado_actual=%', v_id_cita, v_estado;

    -------------------------------------------------------------------------
    -- 4) ACTUALIZAR ESTADO
    -------------------------------------------------------------------------
    SELECT r.status, r.type_error, r.message, r.data
    INTO v_status, v_type_error, v_message, v_data
    FROM terapia.fn_actualizar_estado_cita(
        p_actor_user_id => v_user_id,
        p_id_sesion     => v_id_sesion,
        p_id_cita       => v_id_cita,
        p_nuevo_estado  => 'Confirmada',
        p_motivo        => NULL
    ) r;

    RAISE NOTICE 'Actualizar estado -> status=%, type_error=%, message=%', v_status, v_type_error, v_message;
    RAISE NOTICE 'data=%', v_data;

    RAISE NOTICE '=== FIN WF1 ===';
END $$;
