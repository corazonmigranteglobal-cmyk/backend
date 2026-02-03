-- Puedes cambiar los nombres de schema si quieres
CREATE SCHEMA IF NOT EXISTS usuarios;
CREATE SCHEMA IF NOT EXISTS seguridad;
CREATE SCHEMA IF NOT EXISTS terapia;
create schema if not exists analytics;
CREATE SCHEMA IF NOT EXISTS contabilidad;


-----------------------------------------------------------------------------
--	 							ESQUEMA USUARIOS
-----------------------------------------------------------------------------

CREATE TABLE usuarios.usuario (
    user_id          	integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email            	text NOT NULL UNIQUE,
    telefono         	text,
    password_hash    	text NOT NULL,

    nombre           	text NOT NULL,
    apellido         	text NOT NULL,

    sexo             	text,           
    fecha_nacimiento 	date,


    foto_perfil_link  	text,
    foto_portada_link 	text,

    estado_cuenta    	text NOT NULL DEFAULT 'Pendiente',  -- 'Pendiente','Activo','Bloqueado', etc.

    created_at       	timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       	timestamptz,
    register_status  	text NOT NULL DEFAULT 'Activo',
    id_version       	integer NOT NULL DEFAULT 1
);


CREATE TABLE usuarios.usuario_paciente (
    user_id         integer PRIMARY KEY
                    REFERENCES usuarios.usuario(user_id),

    pais            text,
    ciudad          text,
    ocupacion       text,
    notas_internas  text,
    perfil_psicologico 	jsonb,

    
    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz,
    register_status text NOT NULL DEFAULT 'Activo',
    id_version      integer NOT NULL DEFAULT 1
);


CREATE TABLE usuarios.usuario_terapeuta (
    user_id               integer PRIMARY key REFERENCES usuarios.usuario(user_id),

    titulo_profesional    text,
    especialidad_principal text,
    descripcion_perfil    text,
    frase_personal        text,
    link_video_youtube    text,
    matricula_profesional text,

    pais                  text,
    ciudad                text,

    valor_sesion_base     numeric(12,2),

    created_at            timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            timestamptz,
    register_status       text NOT NULL DEFAULT 'Activo',
    id_version            integer NOT NULL DEFAULT 1
);

CREATE TABLE usuarios.usuario_admin (
    user_id               integer PRIMARY KEY
                          REFERENCES usuarios.usuario(user_id),

    id_usuario_terapeuta  integer
                          REFERENCES usuarios.usuario_terapeuta(user_id),

    pin_admin             text,
    nivel                 text,   -- 'coordinador','admin_sistema','root' (si quieres seguir usándolo)

    is_super_admin        boolean NOT NULL DEFAULT false,
    can_manage_files      boolean NOT NULL DEFAULT false,
    is_accounter		  boolean not null default false,

    created_at            timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            timestamptz,
    register_status       text NOT NULL DEFAULT 'Activo',
    id_version            integer NOT NULL DEFAULT 1
);


CREATE OR REPLACE FUNCTION public.fn_set_audit_fields()
RETURNS trigger AS
$$
BEGIN
    -- updated_at siempre a ahora
    NEW.updated_at := CURRENT_TIMESTAMP;

    -- id_version aumenta en +1 respecto al valor anterior
    NEW.id_version := COALESCE(OLD.id_version, 1) + 1;

    RETURN NEW;
END;
$$
LANGUAGE plpgsql;


-- usuarios.usuario
CREATE TRIGGER trg_usuario_set_audit
BEFORE UPDATE ON usuarios.usuario
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

-- usuarios.usuario_paciente
CREATE TRIGGER trg_usuario_paciente_set_audit
BEFORE UPDATE ON usuarios.usuario_paciente
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

-- usuarios.usuario_terapeuta
CREATE TRIGGER trg_usuario_terapeuta_set_audit
BEFORE UPDATE ON usuarios.usuario_terapeuta 
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

-- usuarios.usuario_admin
CREATE TRIGGER trg_usuario_admin_set_audit
BEFORE UPDATE ON usuarios.usuario_admin
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

-----------------------------------------------------------------------------
--	 							ESQUEMA TERAPIA
-----------------------------------------------------------------------------

CREATE TABLE terapia.enfoque (
    id_enfoque      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          text NOT NULL,
    descripcion     text,
    metadata        jsonb,

    created_at      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz,
    register_status text NOT NULL DEFAULT 'Activo',
    id_version      integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_enfoque_nombre ON terapia.enfoque (nombre);


CREATE TABLE terapia.producto (
    id_producto        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre             text NOT NULL,
    descripcion        text,
    id_enfoque_default integer
                        REFERENCES terapia.enfoque(id_enfoque),

    duracion_minutos   integer NOT NULL DEFAULT 50,
    precio_base        numeric(12,2),
    costo_base         numeric(12,2),
    categoria          text,        -- ej: 'sesion_individual','pareja','taller'
    metadata           jsonb,

    created_at         timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         timestamptz,
    register_status    text NOT NULL DEFAULT 'Activo',
    id_version         integer NOT NULL DEFAULT 1
);


CREATE TABLE terapia.cita (
    id_cita              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_producto          integer NOT NULL
                          REFERENCES terapia.producto(id_producto),
    id_enfoque           integer
                          REFERENCES terapia.enfoque(id_enfoque),

    id_usuario_terapeuta integer NOT NULL
                          REFERENCES usuarios.usuario_terapeuta(user_id),
    id_usuario_paciente  integer NOT NULL
                          REFERENCES usuarios.usuario_paciente(user_id),
    id_usuario_coordinador integer
                          REFERENCES usuarios.usuario(user_id),
                          
    fecha_programada 	 date NOT NULL,
    inicio 				 timestamptz NOT NULL,
	fin    				 timestamptz NOT NULL,

    canal                text,          
    enlace_sesion        text,
    direccion            text,

    estado               text NOT NULL DEFAULT 'Planificada',
    motivo_cancelacion   text,
    motivo_modificacion  text,

    notas_internas       text,

    id_transaccion       integer,

    created_at           timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           timestamptz,
    register_status      text NOT NULL DEFAULT 'Activo',
    id_version           integer NOT NULL DEFAULT 1
);

CREATE TABLE terapia.bloqueo_agenda (
    id_bloqueo           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario_terapeuta integer NOT NULL
                          REFERENCES usuarios.usuario_terapeuta(user_id),

    inicio               timestamptz NOT NULL,
    fin                  timestamptz NOT NULL,
    tipo_bloqueo         text NOT NULL,  -- 'vacaciones','ausencia','bloqueo_manual', etc.
    motivo               text,

    created_at           timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           timestamptz,
    register_status      text NOT NULL DEFAULT 'Activo',
    id_version           integer NOT NULL DEFAULT 1,

    CONSTRAINT ck_bloqueo_rango_valido CHECK (fin > inicio)
);

CREATE INDEX idx_bloqueo_terapeuta_rango
ON terapia.bloqueo_agenda (id_usuario_terapeuta, inicio, fin);

CREATE TRIGGER trg_bloqueo_agenda_set_audit
BEFORE UPDATE ON terapia.bloqueo_agenda
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TRIGGER trg_cita_set_audit
BEFORE UPDATE ON terapia.cita
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TRIGGER trg_producto_set_audit
BEFORE UPDATE ON terapia.producto
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TRIGGER trg_enfoque_set_audit
BEFORE UPDATE ON terapia.enfoque
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();



CREATE TABLE terapia.horario_terapeuta (
    id_horario_terapeuta integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_usuario_terapeuta integer NOT NULL
                          REFERENCES usuarios.usuario_terapeuta(user_id),

    -- 1 = lunes ... 7 = domingo
    dia_semana           smallint NOT NULL,  

    hora_inicio          time NOT NULL,
    hora_fin             time NOT NULL,
	es_laboral boolean NOT NULL DEFAULT true,
    
    -- ejemplo: 'presencial','online','mixto'
    tipo_atencion        text,

    canal                text,       -- 'presencial','online','telefono', etc.
    ubicacion            text,       -- dirección o nombre de consulta, si aplica
    metadata             jsonb,

    created_at           timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           timestamptz,
    register_status      text NOT NULL DEFAULT 'Activo',
    id_version           integer NOT NULL DEFAULT 1,

    CONSTRAINT ck_horario_dia_semana_valido
        CHECK (dia_semana BETWEEN 1 AND 7),

    CONSTRAINT ck_horario_rango_valido
        CHECK (hora_fin > hora_inicio)
);

-- opcional, para evitar duplicados exactos:
CREATE UNIQUE INDEX idx_horario_terapeuta_unique
ON terapia.horario_terapeuta (
    id_usuario_terapeuta, dia_semana, hora_inicio, hora_fin
);

CREATE INDEX idx_horario_terapeuta_dia
ON terapia.horario_terapeuta (id_usuario_terapeuta, dia_semana);

CREATE TRIGGER trg_horario_terapeuta_set_audit
BEFORE UPDATE ON terapia.horario_terapeuta
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();


-----------------------------------------------------------------------------
--	 							ESQUEMA CONTABILIDAD
-----------------------------------------------------------------------------


CREATE TABLE contabilidad.grupo_cuenta (
    id_grupo_cuenta  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre           text NOT NULL,
    codigo           text,  -- ej: '1', '4.1', etc.
    id_grupo_padre   integer
                      REFERENCES contabilidad.grupo_cuenta(id_grupo_cuenta),
    tipo_grupo       text,  -- 'Activo','Pasivo','Patrimonio','Ingreso','Gasto'
    metadata         jsonb,

    created_at       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       timestamptz,
    register_status  text NOT NULL DEFAULT 'Activo',
    id_version       integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_grupo_cuenta_codigo
ON contabilidad.grupo_cuenta (codigo);

CREATE TABLE contabilidad.cuenta (
    id_cuenta        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre           text NOT NULL,
    codigo           text,  -- ej: '1101', '4101'
    id_grupo_cuenta  integer NOT NULL
                      REFERENCES contabilidad.grupo_cuenta(id_grupo_cuenta),

    tipo_cuenta      text,      -- 'Balance','Resultado', etc.
    sub_tipo         text,		-- 'Activo', 'Pasivo'  /  'Ingresos', /'Egresos'
    categoria	     text,		--        
    moneda           text,      -- 'BOB','USD', etc.
    metadata         jsonb,

    created_at       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       timestamptz,
    register_status  text NOT NULL DEFAULT 'Activo',
    id_version       integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_cuenta_codigo
ON contabilidad.cuenta (codigo);

CREATE INDEX idx_cuenta_grupo
ON contabilidad.cuenta (id_grupo_cuenta);


CREATE TABLE contabilidad.transaccion (
    id_transaccion     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha              date NOT NULL,
    tipo_transaccion   text,           -- 'Ingreso','Egreso','Ajuste', etc.
    glosa              text,           -- descripción general
    referencia_externa text,           -- ej: 'cita:123', 'pago:456'

    id_usuario_creador integer
                        REFERENCES usuarios.usuario(user_id),

    metadata           jsonb,

    created_at         timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         timestamptz,
    register_status    text NOT NULL DEFAULT 'Activo',
    id_version         integer NOT NULL DEFAULT 1
);


CREATE TABLE contabilidad.movimiento_cuenta (
    id_movimiento     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_transaccion    integer NOT NULL
                       REFERENCES contabilidad.transaccion(id_transaccion),
    id_cuenta         integer NOT NULL
                       REFERENCES contabilidad.cuenta(id_cuenta),

    debe              numeric(14,2) NOT NULL DEFAULT 0,
    haber             numeric(14,2) NOT NULL DEFAULT 0,
    descripcion       text,

    created_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        timestamptz,
    register_status   text NOT NULL DEFAULT 'Activo',
    id_version        integer NOT NULL DEFAULT 1,

	CONSTRAINT ck_debe_haber_exclusivo
	CHECK (
  		(debe > 0 AND haber = 0)
  		OR (haber > 0 AND debe = 0)
  		OR (debe = 0 AND haber = 0) 
	)
 );


ALTER TABLE terapia.cita
ADD CONSTRAINT fk_cita_transaccion
FOREIGN KEY (id_transaccion)
REFERENCES contabilidad.transaccion(id_transaccion);

CREATE INDEX idx_movimiento_transaccion
ON contabilidad.movimiento_cuenta (id_transaccion);

CREATE INDEX idx_movimiento_cuenta
ON contabilidad.movimiento_cuenta (id_cuenta);

CREATE INDEX idx_transaccion_fecha
ON contabilidad.transaccion (fecha);

CREATE TRIGGER trg_transaccion_set_audit
	BEFORE UPDATE ON contabilidad.transaccion
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TRIGGER trg_cuenta_set_audit
BEFORE UPDATE ON contabilidad.cuenta
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TRIGGER trg_grupo_cuenta_set_audit
BEFORE UPDATE ON contabilidad.grupo_cuenta
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TRIGGER trg_movimiento_cuenta_set_audit
BEFORE UPDATE ON contabilidad.movimiento_cuenta
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

-----------------------------------------------------------------------------
--	 							ESQUEMA SESION
-----------------------------------------------------------------------------

CREATE TABLE seguridad.sesion (
    id_sesion         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id           integer NOT NULL
                      REFERENCES usuarios.usuario(user_id),

    ip_acceso         inet,            -- IP del cliente
    user_agent        text,            -- navegador / dispositivo

    tipo_login        text,            -- 'password','recuperacion','admin', etc.
    tipo_logout       text,            -- 'usuario','expiracion','forzado', etc.

    timestamp_login   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timestamp_logout  timestamptz,

    created_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        timestamptz,
    register_status   text NOT NULL DEFAULT 'Activo',
    id_version        integer NOT NULL DEFAULT 1
);

-- Índices útiles
CREATE INDEX idx_sesion_user
ON seguridad.sesion (user_id, timestamp_login);

CREATE INDEX idx_sesion_timestamp
ON seguridad.sesion (timestamp_login);


CREATE TABLE seguridad.action_log (
    id_action         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_sesion         integer NOT NULL
                      REFERENCES seguridad.sesion(id_sesion),

    user_id           integer NOT NULL
                      REFERENCES usuarios.usuario(user_id),

    tipo_accion       text NOT NULL,   -- 'CREAR_CITA','CANCELAR_CITA','LOGIN_FALLIDO', etc.
    tipo_contenedor   text,            -- 'cita','usuario','producto','cuenta', etc.
    id_contenedor     integer,         

    detalles          jsonb,           

    timestamp_accion  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        timestamptz,
    register_status   text NOT NULL DEFAULT 'Activo',
    id_version        integer NOT NULL DEFAULT 1
);

CREATE INDEX idx_action_log_tipo_accion
ON seguridad.action_log (tipo_accion);

-- Tabla para manejar PINs de autenticación por email
CREATE TABLE seguridad.auth_pin (
    id_auth_pin       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    email             text NOT NULL,    -- correo al que se envía el pin
    user_id           integer           -- opcional: si ya tenemos usuario
                      REFERENCES usuarios.usuario(user_id),

    pin_code          text NOT NULL,    -- ej: '123456' (6 dígitos)
    tipo_pin          text NOT NULL,    -- 'registro','login','reset_password','cambio_email', etc.

    contexto          text,             
    metadata          jsonb,            

    expires_at        timestamptz NOT NULL, -- fecha/hora de expiración
    is_used           boolean NOT NULL DEFAULT false,
    used_at           timestamptz,

    intentos          integer NOT NULL DEFAULT 0,  -- intentos de validación
    max_intentos      integer NOT NULL DEFAULT 5,  -- puedes limitarlo

    created_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        timestamptz,
    register_status   text NOT NULL DEFAULT 'Activo',
    id_version        integer NOT NULL DEFAULT 1
);

-- Índices útiles para buscar por email/tipo y descartar expirados
CREATE INDEX idx_auth_pin_email_tipo
ON seguridad.auth_pin (email, tipo_pin, is_used, created_at);

CREATE INDEX idx_auth_pin_user
ON seguridad.auth_pin (user_id);


-- Visitas de usuarios no logueados / tráfico público
CREATE TABLE seguridad.visita_publica (
    id_visita         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    ip_acceso         inet,            -- IP del cliente
    user_agent        text,            -- navegador / dispositivo
    metodo_http       text,            -- 'GET','POST', etc.
    path              text,            -- ruta /url sin dominio (ej: '/home','/terapeuta/123')
    query_string      text,            -- parte de la URL después de '?', si quieres guardarla
    referrer          text,            -- desde dónde llegó (otra página, google, etc.)

    session_public_id text,            -- un id anónimo (cookie) para agrupar visitas de la misma persona
    pais              text,            -- opcional, si luego quieres resolver IP → país
    device_type       text,            -- 'desktop','mobile','tablet', etc. (si lo detectas en backend)

    timestamp_visita  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata          jsonb,           -- espacio para guardar más cosas específicas (utm_source, etc.)

    created_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        timestamptz,
    register_status   text NOT NULL DEFAULT 'Activo',
    id_version        integer NOT NULL DEFAULT 1
);

ALTER TABLE seguridad.auth_pin
    DROP COLUMN IF EXISTS expires_at,
    ADD COLUMN life_time interval NOT NULL DEFAULT '10 minutes';

-- Índices útiles para analítica
CREATE INDEX idx_visita_publica_timestamp
ON seguridad.visita_publica (timestamp_visita);

CREATE INDEX idx_visita_publica_path
ON seguridad.visita_publica (path);

CREATE INDEX idx_visita_publica_session
ON seguridad.visita_publica (session_public_id);

-- Trigger de auditoría
CREATE TRIGGER trg_visita_publica_set_audit
BEFORE UPDATE ON seguridad.visita_publica
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TRIGGER trg_auth_pin_set_audit
BEFORE UPDATE ON seguridad.auth_pin
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

-- Trigger de auditoría
CREATE TRIGGER trg_action_log_set_audit
BEFORE UPDATE ON seguridad.action_log
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TRIGGER trg_sesion_set_audit
BEFORE UPDATE ON seguridad.sesion
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();


CREATE OR REPLACE FUNCTION usuarios.fn_trg_enforce_exclusive_roles()
RETURNS trigger
LANGUAGE plpgsql
AS
$$
DECLARE
    v_user_id integer := NEW.user_id;
BEGIN
    IF NEW.register_status IS DISTINCT FROM 'Activo' THEN
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'usuario_paciente' THEN

        IF EXISTS (
            SELECT 1
            FROM usuarios.usuario_terapeuta t
            WHERE t.user_id = v_user_id
              AND t.register_status = 'Activo'
        ) THEN
            RAISE EXCEPTION
                'El usuario % ya tiene rol TERAPEUTA activo. Los roles son mutuamente excluyentes.',
                v_user_id;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM usuarios.usuario_admin a
            WHERE a.user_id = v_user_id
              AND a.register_status = 'Activo'
        ) THEN
            RAISE EXCEPTION
                'El usuario % ya tiene rol ADMIN activo. Los roles son mutuamente excluyentes.',
                v_user_id;
        END IF;

    ELSIF TG_TABLE_NAME = 'usuario_terapeuta' THEN

        IF EXISTS (
            SELECT 1
            FROM usuarios.usuario_paciente p
            WHERE p.user_id = v_user_id
              AND p.register_status = 'Activo'
        ) THEN
            RAISE EXCEPTION
                'El usuario % ya tiene rol PACIENTE activo. Los roles son mutuamente excluyentes.',
                v_user_id;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM usuarios.usuario_admin a
            WHERE a.user_id = v_user_id
              AND a.register_status = 'Activo'
        ) THEN
            RAISE EXCEPTION
                'El usuario % ya tiene rol ADMIN activo. Los roles son mutuamente excluyentes.',
                v_user_id;
        END IF;

    ELSIF TG_TABLE_NAME = 'usuario_admin' THEN

        IF EXISTS (
            SELECT 1
            FROM usuarios.usuario_paciente p
            WHERE p.user_id = v_user_id
              AND p.register_status = 'Activo'
        ) THEN
            RAISE EXCEPTION
                'El usuario % ya tiene rol PACIENTE activo. Los roles son mutuamente excluyentes.',
                v_user_id;
        END IF;

        IF EXISTS (
            SELECT 1
            FROM usuarios.usuario_terapeuta t
            WHERE t.user_id = v_user_id
              AND t.register_status = 'Activo'
        ) THEN
            RAISE EXCEPTION
                'El usuario % ya tiene rol TERAPEUTA activo. Los roles son mutuamente excluyentes.',
                v_user_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

-- Triggers en las tres tablas de rol
CREATE TRIGGER trg_usuario_paciente_exclusive
BEFORE INSERT OR UPDATE ON usuarios.usuario_paciente
FOR EACH ROW
EXECUTE FUNCTION usuarios.fn_trg_enforce_exclusive_roles();

CREATE TRIGGER trg_usuario_terapeuta_exclusive
BEFORE INSERT OR UPDATE ON usuarios.usuario_terapeuta
FOR EACH ROW
EXECUTE FUNCTION usuarios.fn_trg_enforce_exclusive_roles();

CREATE TRIGGER trg_usuario_admin_exclusive
BEFORE INSERT OR UPDATE ON usuarios.usuario_admin
FOR EACH ROW
EXECUTE FUNCTION usuarios.fn_trg_enforce_exclusive_roles();


CREATE TABLE contabilidad.transaccion_venta(
    id_transaccion int PRIMARY KEY
        REFERENCES contabilidad.transaccion(id_transaccion)
        ON DELETE CASCADE,

    cantidad     int NOT NULL CHECK (cantidad > 0),
    id_producto  int NOT NULL REFERENCES terapia.producto(id_producto),

    id_cita      int REFERENCES terapia.cita(id_cita)
);


CREATE TRIGGER trg_contabilidad_transaccion_venta
BEFORE UPDATE ON contabilidad.transaccion_venta
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();

CREATE TABLE analytics.ui_event (
    id_event          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    session_public_id text,        -- tu cookie anónima para agrupar
    user_id           integer,     -- opcional, si el user está logueado
    timestamp_event   timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    event_type        text NOT NULL,   -- 'click','change','select','hover', etc.
    element_key       text NOT NULL,   -- identificador lógico: 'filtro_enfoque','card_terapeuta','btn_reservar'
    element_value     text,           -- el valor seleccionado (ej: 'TCC','Terapia pareja')
    page_path         text,           -- '/home','/search','/terapeuta/123'
    metadata          jsonb,          -- extra: { "position": 3, "label": "CBT" }

    created_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        timestamptz,
    register_status   text NOT NULL DEFAULT 'Activo',
    id_version        integer NOT NULL DEFAULT 1
);

CREATE INDEX idx_ui_event_session ON analytics.ui_event (session_public_id, timestamp_event);
CREATE INDEX idx_ui_event_element ON analytics.ui_event (element_key);
CREATE INDEX idx_ui_event_page    ON analytics.ui_event (page_path);

CREATE TRIGGER trg_ui_event_set_audit
BEFORE UPDATE ON analytics.ui_event
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();


-- Requiere extensión btree_gist
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE terapia.bloqueo_agenda
ADD CONSTRAINT ex_bloqueo_solape
EXCLUDE USING gist (
  id_usuario_terapeuta WITH =,
  tstzrange(inicio, fin, '[)') WITH &&
)
WHERE (register_status = 'Activo');

ALTER TABLE terapia.cita
ADD CONSTRAINT ex_cita_solape
EXCLUDE USING gist (
  id_usuario_terapeuta WITH =,
  tstzrange(inicio, fin, '[)') WITH &&
)
WHERE (register_status = 'Activo' AND estado <> 'Cancelada');


CREATE OR REPLACE FUNCTION contabilidad.fn_assert_transaccion_balance(p_id_transaccion integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_debe  numeric(14,2);
    v_haber numeric(14,2);
BEGIN
    IF p_id_transaccion IS NULL THEN
        RETURN;
    END IF;

    -- Si la transacción no está activa, no forzamos balance
    IF NOT EXISTS (
        SELECT 1
        FROM contabilidad.transaccion t
        WHERE t.id_transaccion = p_id_transaccion
          AND t.register_status = 'Activo'
    ) THEN
        RETURN;
    END IF;

    SELECT
        COALESCE(SUM(m.debe),  0),
        COALESCE(SUM(m.haber), 0)
    INTO v_debe, v_haber
    FROM contabilidad.movimiento_cuenta m
    WHERE m.id_transaccion = p_id_transaccion
      AND m.register_status = 'Activo';

    IF v_debe <> v_haber THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = format(
                'Transacción %s desbalanceada: debe=%s, haber=%s',
                p_id_transaccion, v_debe, v_haber
            );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION contabilidad.trg_assert_transaccion_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM contabilidad.fn_assert_transaccion_balance(NEW.id_transaccion);

    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM contabilidad.fn_assert_transaccion_balance(NEW.id_transaccion);

        IF OLD.id_transaccion IS DISTINCT FROM NEW.id_transaccion THEN
            PERFORM contabilidad.fn_assert_transaccion_balance(OLD.id_transaccion);
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        PERFORM contabilidad.fn_assert_transaccion_balance(OLD.id_transaccion);
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimiento_cuenta_balance ON contabilidad.movimiento_cuenta;

CREATE CONSTRAINT TRIGGER trg_movimiento_cuenta_balance
AFTER INSERT OR UPDATE OR DELETE ON contabilidad.movimiento_cuenta
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION contabilidad.trg_assert_transaccion_balance();



-- Intento de cobro (lo que tu sistema “pretende” cobrar)
CREATE TABLE IF NOT EXISTS contabilidad.pago_intent (
    id_pago_intent        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_cita               integer
                          REFERENCES terapia.cita(id_cita),

    id_transaccion        integer
                          REFERENCES contabilidad.transaccion(id_transaccion),

    id_usuario_pagador    integer NOT NULL
                          REFERENCES usuarios.usuario(user_id),

    id_usuario_terapeuta  integer
                          REFERENCES usuarios.usuario_terapeuta(user_id),

    moneda                text NOT NULL DEFAULT 'BOB',
    monto                 numeric(14,2) NOT NULL,
    CONSTRAINT ck_pago_intent_monto_positivo CHECK (monto > 0),

    pasarela              text NOT NULL,  -- 'payoneer','stripe','paypal', etc.
    estado                text NOT NULL DEFAULT 'CREADO',
    -- Sugeridos: CREADO|PENDIENTE|AUTORIZADO|CAPTURADO|PAGADO|FALLIDO|CANCELADO|REEMBOLSADO|EXPIRADO

    idempotency_key       text,           -- para reintentos seguros
    provider_payment_id   text,           -- id principal del proveedor
    provider_reference    text,           -- referencia/orden externa
    provider_status       text,           -- estado crudo del proveedor
    checkout_url          text,           -- link de pago si aplica
    expires_at            timestamptz,

    metadata              jsonb,
    provider_metadata     jsonb,

    created_at            timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            timestamptz,
    register_status       text NOT NULL DEFAULT 'Activo',
    id_version            integer NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pago_intent_idempotency
ON contabilidad.pago_intent (pasarela, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pago_intent_cita
ON contabilidad.pago_intent (id_cita);

CREATE INDEX IF NOT EXISTS idx_pago_intent_transaccion
ON contabilidad.pago_intent (id_transaccion);

CREATE INDEX IF NOT EXISTS idx_pago_intent_estado
ON contabilidad.pago_intent (estado, created_at);

CREATE TRIGGER trg_pago_intent_set_audit
BEFORE UPDATE ON contabilidad.pago_intent
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();


-- Eventos crudos/idempotentes del proveedor (webhooks o polling)
CREATE TABLE IF NOT EXISTS contabilidad.pago_event (
    id_pago_event         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_pago_intent        integer
                          REFERENCES contabilidad.pago_intent(id_pago_intent)
                          ON DELETE CASCADE,

    pasarela              text NOT NULL,
    event_id              text NOT NULL,  -- id único del evento en el proveedor
    event_type            text NOT NULL,  -- 'payment.succeeded', 'payment.failed', etc.
    event_timestamp       timestamptz,    -- timestamp del proveedor (si viene)

    signature             text,           -- firma del webhook si aplica
    payload               jsonb NOT NULL, -- payload crudo completo

    received_at           timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed             boolean NOT NULL DEFAULT false,
    processed_at          timestamptz,
    process_error         text,

    created_at            timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            timestamptz,
    register_status       text NOT NULL DEFAULT 'Activo',
    id_version            integer NOT NULL DEFAULT 1,

    CONSTRAINT uq_pago_event UNIQUE (pasarela, event_id)
);

CREATE INDEX IF NOT EXISTS idx_pago_event_intent
ON contabilidad.pago_event (id_pago_intent, received_at);

CREATE INDEX IF NOT EXISTS idx_pago_event_processed
ON contabilidad.pago_event (processed, received_at);

CREATE TRIGGER trg_pago_event_set_audit
BEFORE UPDATE ON contabilidad.pago_event
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_audit_fields();



CREATE SCHEMA IF NOT EXISTS mensajeria;

CREATE TABLE IF NOT EXISTS mensajeria.mensaje_outbox (
  id_mensaje           bigserial PRIMARY KEY,
  tipo                text NOT NULL, -- ej: 'EMAIL_VERIFICACION', 'CITA_RECORDATORIO', etc.
  canal               text NOT NULL DEFAULT 'EMAIL', -- EMAIL | WHATSAPP | SMS (por futuro)
  prioridad           smallint NOT NULL DEFAULT 5, -- 1=alta, 10=baja

  -- destinatarios / payload
  para                text NOT NULL, -- email destino (para EMAIL). Para otros canales puede ser teléfono, etc.
  template_key        text NULL,      -- si usas plantillas por key
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb, -- datos de la plantilla, links, etc.

  -- control de ejecución
  estado              text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE|PROCESANDO|ENVIADO|FALLIDO|CANCELADO
  intentos            integer NOT NULL DEFAULT 0,
  max_intentos        integer NOT NULL DEFAULT 6,

  next_run_at         timestamptz NOT NULL DEFAULT now(),
  locked_at           timestamptz NULL,
  locked_by           text NULL,

  last_error          text NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz NULL
);

CREATE INDEX IF NOT EXISTS ix_outbox_estado_next_run
  ON mensajeria.mensaje_outbox (estado, next_run_at);

CREATE INDEX IF NOT EXISTS ix_outbox_locked
  ON mensajeria.mensaje_outbox (locked_at);

CREATE TABLE IF NOT EXISTS mensajeria.mensaje_envio_log (
  id_log        bigserial PRIMARY KEY,
  id_mensaje    bigint NOT NULL REFERENCES mensajeria.mensaje_outbox(id_mensaje),
  ok            boolean NOT NULL,
  provider_id   text NULL,
  respuesta     jsonb NULL,
  error         text NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
