CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
--						USERS-CREATION-UPDATES
-- =====================================================================
-- FUNCIONS WORFLOW:  
-- 1. Any type of user creation calls fn_signup_with_verification_pin, as 
-- base behavior.s
-- 2. Once the specific type of user is created the PIN email is sent in 
-- order to verify the identity.

CREATE OR REPLACE FUNCTION seguridad.fn_verificar_auth_pin(
    p_email    text,
    p_tipo_pin text,
    p_pin_code text
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_auth          seguridad.auth_pin%ROWTYPE;
    v_now           timestamptz := now();
    v_expires_at    timestamptz;
    v_rows_updated  integer := 0;
BEGIN
    ------------------------------------------------------------------
    -- 1) Buscar el PIN más reciente para ese email / tipo / código
    ------------------------------------------------------------------
    SELECT *
    INTO v_auth
    FROM seguridad.auth_pin ap
    WHERE ap.email    = p_email
      AND ap.tipo_pin = p_tipo_pin
      AND ap.pin_code = p_pin_code
    ORDER BY ap.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'error',
            'PIN_NOT_FOUND',
            'PIN inválido o no encontrado',
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Verificar expiración
    ------------------------------------------------------------------
    v_expires_at := v_auth.created_at + v_auth.life_time;

    IF v_now > v_expires_at THEN
        UPDATE seguridad.auth_pin
        SET used_at = COALESCE(used_at, v_now)
        WHERE id_auth_pin = v_auth.id_auth_pin;

        RETURN QUERY
        SELECT
            'error',
            'PIN_EXPIRED',
            'El PIN ha expirado',
            jsonb_build_object(
                'id_auth_pin', v_auth.id_auth_pin,
                'user_id',     v_auth.user_id,
                'email',       v_auth.email,
                'tipo_pin',    v_auth.tipo_pin
            );
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Verificar si ya fue usado
    ------------------------------------------------------------------
    IF v_auth.used_at IS NOT NULL THEN
        RETURN QUERY
        SELECT
            'error',
            'PIN_ALREADY_USED',
            'El PIN ya fue utilizado',
            jsonb_build_object(
                'id_auth_pin', v_auth.id_auth_pin,
                'user_id',     v_auth.user_id,
                'email',       v_auth.email,
                'tipo_pin',    v_auth.tipo_pin
            );
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) Marcar PIN como usado
    ------------------------------------------------------------------
    UPDATE seguridad.auth_pin
    SET used_at = v_now
    WHERE id_auth_pin = v_auth.id_auth_pin;

    ------------------------------------------------------------------
    -- 5) Si es PIN de registro, ACTIVAR cuenta
    ------------------------------------------------------------------
    IF v_auth.tipo_pin = 'registro' THEN
		RAISE NOTICE 'Inside activacion';

        UPDATE usuarios.usuario u
        SET estado_cuenta = 'Activo'
        WHERE u.user_id       = v_auth.user_id
          AND u.estado_cuenta = 'Pendiente';

        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    END IF;

    ------------------------------------------------------------------
    -- 6) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok',
        NULL::text,
        CASE
            WHEN v_auth.tipo_pin = 'registro' AND v_rows_updated > 0
                THEN 'PIN verificado y cuenta activada'
            WHEN v_auth.tipo_pin = 'registro' AND v_rows_updated = 0
                THEN 'PIN verificado, pero la cuenta ya estaba activada'
            ELSE
                'PIN verificado correctamente'
        END,
        jsonb_build_object(
            'id_auth_pin',      v_auth.id_auth_pin,
            'user_id',          v_auth.user_id,
            'email',            v_auth.email,
            'tipo_pin',         v_auth.tipo_pin,
            'cuenta_activada',  (v_rows_updated > 0)
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error',
            'INTERNAL_ERROR',
            'Error al verificar el PIN',
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.fn_signup_paciente_with_verification_pin(
	p_email text, 
	p_password text, 
	p_nombre text, 
	p_apellido text, 
	p_telefono text DEFAULT NULL::text, 
	p_sexo text DEFAULT NULL::text, 
	p_fecha_nacimiento date DEFAULT NULL::date, 
	p_pais text DEFAULT NULL::text, 
	p_ciudad text DEFAULT NULL::text, 
	p_ocupacion text DEFAULT NULL::text, 
	p_perfil_psicologico jsonb DEFAULT NULL::jsonb, 
	p_pin_life_time interval DEFAULT '00:10:00'::interval, 
	p_pin_contexto text DEFAULT 'signup_paciente'::text,
	p_pin_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS TABLE(
	status text, 
	type_error text, 
	message text, 
	data jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status_base     text;
    v_type_error_base text;
    v_message_base    text;
    v_data_base       jsonb;

    v_user_id     integer;
    v_id_auth_pin integer;
    v_pin_code    text;
    v_life_time   interval;

    v_paciente    usuarios.usuario_paciente%ROWTYPE;
BEGIN
    ------------------------------------------------------------------
    -- 1) Crear usuario base + PIN usando la función genérica
    ------------------------------------------------------------------
    SELECT s.status, s.type_error, s.message, s.data
    INTO v_status_base, v_type_error_base, v_message_base, v_data_base
    FROM usuarios.fn_signup_with_verification_pin(
        p_email,
        p_password,
        p_nombre,
        p_apellido,
        p_telefono,
        p_sexo,
        p_fecha_nacimiento,
        p_pin_life_time,
        p_pin_contexto,
        p_pin_metadata
    ) AS s;

    IF v_status_base <> 'ok' THEN
        RETURN QUERY
        SELECT
            v_status_base,
            v_type_error_base,
            v_message_base,
            v_data_base;
        RETURN;
    END IF;

    v_user_id     := (v_data_base->>'user_id')::integer;
    v_id_auth_pin := (v_data_base->>'id_auth_pin')::integer;
    v_pin_code    := v_data_base->>'pin_code';
    v_life_time   := (v_data_base->>'life_time')::interval;

    ------------------------------------------------------------------
    -- 2) Crear registro de paciente
    ------------------------------------------------------------------
    INSERT INTO usuarios.usuario_paciente(
        user_id,
        pais,
        ciudad,
        ocupacion,
        perfil_psicologico
    )
    VALUES (
        v_user_id,
        p_pais,
        p_ciudad,
        p_ocupacion,
        p_perfil_psicologico
    )
    RETURNING *
    INTO v_paciente;

    ------------------------------------------------------------------
    -- 3) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok'::text,
        NULL::text,
        'Paciente registrado correctamente. Se ha enviado un PIN de verificación.'::text,
        jsonb_build_object(
            'user_id',        v_user_id,
            'role',           'paciente',
            'id_auth_pin',    v_id_auth_pin,
            'pin_code',       v_pin_code,
            'life_time',      v_life_time,
            'paciente',       to_jsonb(v_paciente)
        );
    RETURN;

EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'PACIENTE_ALREADY_EXISTS'::text,
            'El usuario ya tiene registro como paciente.'::text,
            jsonb_build_object(
                'user_id', v_user_id
            );
        RETURN;

    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'INTERNAL_ERROR'::text,
            'Error interno al registrar paciente.'::text,
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION usuarios.fn_signup_terapeuta_with_verification_pin(p_email text, p_password text, p_nombre text, p_apellido text, p_telefono text DEFAULT NULL::text, p_sexo text DEFAULT NULL::text, p_fecha_nacimiento date DEFAULT NULL::date, p_titulo_profesional text DEFAULT NULL::text, p_especialidad_princ text DEFAULT NULL::text, p_descripcion_perfil text DEFAULT NULL::text, p_frase_personal text DEFAULT NULL::text, p_link_video_youtube text DEFAULT NULL::text, p_matricula_profesional text DEFAULT NULL::text, p_pais text DEFAULT NULL::text, p_ciudad text DEFAULT NULL::text, p_valor_sesion_base numeric DEFAULT NULL::numeric, p_pin_life_time interval DEFAULT '00:10:00'::interval, p_pin_contexto text DEFAULT 'signup_terapeuta'::text, p_pin_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(status text, type_error text, message text, data jsonb)
 LANGUAGE plpgsql
AS $$
DECLARE
    v_status_base     text;
    v_type_error_base text;
    v_message_base    text;
    v_data_base       jsonb;

    v_user_id     integer;
    v_id_auth_pin integer;
    v_pin_code    text;
    v_life_time   interval;

    v_terapeuta   usuarios.usuario_terapeuta%ROWTYPE;
BEGIN
    ------------------------------------------------------------------
    -- 1) Crear usuario base + PIN
    ------------------------------------------------------------------
    SELECT s.status, s.type_error, s.message, s.data
    INTO v_status_base, v_type_error_base, v_message_base, v_data_base
    FROM usuarios.fn_signup_with_verification_pin(
        p_email,
        p_password,
        p_nombre,
        p_apellido,
        p_telefono,
        p_sexo,
        p_fecha_nacimiento,
        p_pin_life_time,
        p_pin_contexto,
        p_pin_metadata
    )as s;

    IF v_status_base <> 'ok' THEN
        RETURN QUERY
        SELECT
            v_status_base,
            v_type_error_base,
            v_message_base,
            v_data_base;
        RETURN;
    END IF;

    v_user_id     := (v_data_base->>'user_id')::integer;
    v_id_auth_pin := (v_data_base->>'id_auth_pin')::integer;
    v_pin_code    := v_data_base->>'pin_code';
    v_life_time   := (v_data_base->>'life_time')::interval;

    ------------------------------------------------------------------
    -- 2) Crear registro de terapeuta
    ------------------------------------------------------------------
    INSERT INTO usuarios.usuario_terapeuta(
        user_id,
        titulo_profesional,
        especialidad_principal,
        descripcion_perfil,
        frase_personal,
        link_video_youtube,
        matricula_profesional,
        pais,
        ciudad,
        valor_sesion_base
    )
    VALUES (
        v_user_id,
        p_titulo_profesional,
        p_especialidad_princ,
        p_descripcion_perfil,
        p_frase_personal,
        p_link_video_youtube,
        p_matricula_profesional,
        p_pais,
        p_ciudad,
        p_valor_sesion_base
    )
    RETURNING *
    INTO v_terapeuta;

    ------------------------------------------------------------------
    -- 3) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok'::text,
        NULL::text,
        'Terapeuta registrado correctamente. Se ha enviado un PIN de verificación.'::text,
        jsonb_build_object(
            'user_id',     v_user_id,
            'role',        'terapeuta',
            'id_auth_pin', v_id_auth_pin,
            'pin_code',    v_pin_code,
            'life_time',   v_life_time,
            'terapeuta',   to_jsonb(v_terapeuta)
        );
    RETURN;

EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'TERAPEUTA_ALREADY_EXISTS'::text,
            'El usuario ya tiene registro como terapeuta.'::text,
            jsonb_build_object(
                'user_id', v_user_id
            );
        RETURN;

    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'INTERNAL_ERROR'::text,
            'Error interno al registrar terapeuta.'::text,
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.fn_signup_admin_with_verification_pin(
    p_email                text,
    p_password             text,
    p_nombre               text,
    p_apellido             text,
    p_telefono             text DEFAULT NULL,
    p_sexo                 text DEFAULT NULL,
    p_fecha_nacimiento     date DEFAULT NULL,

    p_id_usuario_terapeuta integer DEFAULT NULL,
    p_nivel                text    DEFAULT NULL,
    p_is_super_admin       boolean DEFAULT false,
    p_can_manage_files     boolean DEFAULT false,
    p_is_accounter         boolean DEFAULT false,

    p_pin_life_time        interval DEFAULT '10 minutes',
    p_pin_contexto         text     DEFAULT 'signup_admin',
    p_pin_metadata         jsonb    DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_status_base     text;
    v_type_error_base text;
    v_message_base    text;
    v_data_base       jsonb;

    v_user_id     integer;
    v_id_auth_pin integer;
    v_pin_code    text;
    v_life_time   interval;

    v_admin       usuarios.usuario_admin%ROWTYPE;
BEGIN
    ------------------------------------------------------------------
    -- 1) Crear usuario base + PIN
    ------------------------------------------------------------------
    SELECT s.status, s.type_error, s.message, s.data
    INTO v_status_base, v_type_error_base, v_message_base, v_data_base
    FROM usuarios.fn_signup_with_verification_pin(
        p_email,
        p_password,
        p_nombre,
        p_apellido,
        p_telefono,
        p_sexo,
        p_fecha_nacimiento,
        p_pin_life_time,
        p_pin_contexto,
        p_pin_metadata
    ) as s;

    IF v_status_base <> 'ok' THEN
        RETURN QUERY
        SELECT
            v_status_base,
            v_type_error_base,
            v_message_base,
            v_data_base;
        RETURN;
    END IF;

    v_user_id     := (v_data_base->>'user_id')::integer;
    v_id_auth_pin := (v_data_base->>'id_auth_pin')::integer;
    v_pin_code    := v_data_base->>'pin_code';
    v_life_time   := (v_data_base->>'life_time')::interval;

    ------------------------------------------------------------------
    -- 2) Crear registro de admin
    ------------------------------------------------------------------
    INSERT INTO usuarios.usuario_admin(
        user_id,
        id_usuario_terapeuta,
        nivel,
        is_super_admin,
        can_manage_files,
        is_accounter
    )
    VALUES (
        v_user_id,
        p_id_usuario_terapeuta,
        p_nivel,
        p_is_super_admin,
        p_can_manage_files,
        p_is_accounter
    )
    RETURNING *
    INTO v_admin;

    ------------------------------------------------------------------
    -- 3) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok'::text,
        NULL::text,
        'Admin registrado correctamente. Se ha enviado un PIN de verificación.'::text,
        jsonb_build_object(
            'user_id',     v_user_id,
            'role',        'admin',
            'id_auth_pin', v_id_auth_pin,
            'pin_code',    v_pin_code,
            'life_time',   v_life_time,
            'admin',       to_jsonb(v_admin)
        );
    RETURN;

EXCEPTION
    WHEN unique_violation THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'ADMIN_ALREADY_EXISTS'::text,
            'El usuario ya tiene registro como admin.'::text,
            jsonb_build_object(
                'user_id', v_user_id
            );
        RETURN;

    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'INTERNAL_ERROR'::text,
            'Error interno al registrar admin.'::text,
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION seguridad.fn_logout_user_sessions(
    p_user_id     integer,
    p_tipo_logout text DEFAULT 'replaced_by_new_login'
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_closed_count integer := 0;
    v_sessions_json jsonb := '[]'::jsonb;
BEGIN
    ------------------------------------------------------------------
    -- Cerrar todas las sesiones abiertas (timestamp_logout IS NULL)
    -- del usuario indicado
    ------------------------------------------------------------------
    WITH closed AS (
        UPDATE seguridad.sesion s
        SET tipo_logout      = COALESCE(p_tipo_logout, 'replaced_by_new_login'),
            timestamp_logout = CURRENT_TIMESTAMP
        WHERE s.user_id = p_user_id
          AND s.timestamp_logout IS NULL
        RETURNING s.id_sesion, s.timestamp_login, s.timestamp_logout
    )
    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id_sesion',        id_sesion,
                    'timestamp_login',  timestamp_login,
                    'timestamp_logout', timestamp_logout
                )
            ),
            '[]'::jsonb
        ),
        COUNT(*)
    INTO v_sessions_json, v_closed_count
    FROM closed;

    RETURN QUERY
    SELECT
        'ok'::text,
        NULL::text,
        'Sesiones cerradas correctamente'::text,
        jsonb_build_object(
            'user_id',      p_user_id,
            'total_closed', v_closed_count,
            'sessions',     v_sessions_json
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'INTERNAL_ERROR'::text,
            'Error al cerrar sesiones del usuario'::text,
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE,
                'user_id',       p_user_id
            );
        RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.fn_login_password(
    p_email       text,
    p_password    text,
    p_ip_acceso   text DEFAULT NULL,
    p_user_agent  text DEFAULT NULL,
    p_tipo_login  text DEFAULT 'password'
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_user                       usuarios.usuario%ROWTYPE;
    v_id_sesion                  integer;

    v_is_paciente                boolean := false;
    v_is_terapeuta               boolean := false;
    v_is_admin                   boolean := false;
    v_is_super_admin             boolean := false;
    v_can_manage_files           boolean := false;
    v_is_accounter               boolean := false;
    v_id_usuario_terapeuta_admin integer;

    v_roles_count                integer := 0;
    v_role_principal             text;
BEGIN
    ------------------------------------------------------------------
    -- 1) Buscar usuario activo por email
    ------------------------------------------------------------------
    SELECT u.*
    INTO v_user
    FROM usuarios.usuario u
    WHERE u.email = p_email
      AND u.register_status = 'Activo';

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'USER_NOT_FOUND_OR_INACTIVE'::text,
            'Usuario no encontrado o inactivo'::text,
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Verificar estado de cuenta
    ------------------------------------------------------------------
    IF v_user.estado_cuenta IS DISTINCT FROM 'Activo' THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'ACCOUNT_NOT_ACTIVE'::text,
            'La cuenta no está activa para iniciar sesión'::text,
            jsonb_build_object(
                'estado_cuenta', v_user.estado_cuenta
            );
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Verificar contraseña con pgcrypto
    ------------------------------------------------------------------
    IF v_user.password_hash IS NULL
       OR crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'INVALID_PASSWORD'::text,
            'Contraseña incorrecta'::text,
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) Determinar rol (MUTUAMENTE EXCLUYENTE)
    ------------------------------------------------------------------

    -- ¿Paciente?
    SELECT EXISTS (
        SELECT 1
        FROM usuarios.usuario_paciente up
        WHERE up.user_id = v_user.user_id
          AND up.register_status = 'Activo'
    )
    INTO v_is_paciente;

    IF v_is_paciente THEN
        v_roles_count := v_roles_count + 1;
    END IF;

    -- ¿Terapeuta?
    SELECT EXISTS (
        SELECT 1
        FROM usuarios.usuario_terapeuta ut
        WHERE ut.user_id = v_user.user_id
          AND ut.register_status = 'Activo'
    )
    INTO v_is_terapeuta;

    IF v_is_terapeuta THEN
        v_roles_count := v_roles_count + 1;
    END IF;

    -- ¿Admin?
    SELECT
        ua.is_super_admin,
        ua.can_manage_files,
        ua.is_accounter,
        ua.id_usuario_terapeuta
    INTO
        v_is_super_admin,
        v_can_manage_files,
        v_is_accounter,
        v_id_usuario_terapeuta_admin
    FROM usuarios.usuario_admin ua
    WHERE ua.user_id = v_user.user_id
      AND ua.register_status = 'Activo';

    IF FOUND THEN
        v_is_admin    := true;
        v_roles_count := v_roles_count + 1;
    ELSE
        v_is_admin                   := false;
        v_is_super_admin             := false;
        v_can_manage_files           := false;
        v_is_accounter               := false;
        v_id_usuario_terapeuta_admin := NULL;
    END IF;

    ------------------------------------------------------------------
    -- 5) Validar exclusividad de rol
    ------------------------------------------------------------------
    IF v_roles_count > 1 THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'ROLE_CONFIGURATION_ERROR'::text,
            'Usuario tiene más de un rol asignado, revisar configuración'::text,
            jsonb_build_object(
                'user_id',           v_user.user_id,
                'is_paciente',       v_is_paciente,
                'is_terapeuta',      v_is_terapeuta,
                'is_admin',          v_is_admin,
                'is_super_admin',    v_is_super_admin,
                'can_manage_files',  v_can_manage_files,
                'is_accounter',      v_is_accounter
            );
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 6) Definir rol principal para el front
    ------------------------------------------------------------------
    IF v_roles_count = 0 THEN
        v_role_principal := 'usuario';
    ELSIF v_is_admin THEN
        IF v_is_super_admin THEN
            v_role_principal := 'super_admin';
        ELSE
            v_role_principal := 'admin';
        END IF;
    ELSIF v_is_terapeuta THEN
        v_role_principal := 'terapeuta';
    ELSIF v_is_paciente THEN
        v_role_principal := 'paciente';
    ELSE
        v_role_principal := 'usuario';
    END IF;

    ------------------------------------------------------------------
    -- 7) Cerrar cualquier sesión abierta anterior (logout interno)
    ------------------------------------------------------------------
    PERFORM *
    FROM seguridad.fn_logout_user_sessions(
        v_user.user_id,
        'replaced_by_new_login'
    );

    ------------------------------------------------------------------
    -- 8) Crear una nueva sesión
    ------------------------------------------------------------------
    INSERT INTO seguridad.sesion(
        user_id,
        ip_acceso,
        user_agent,
        tipo_login
    )
    VALUES (
        v_user.user_id,
        CASE
            WHEN p_ip_acceso IS NULL OR p_ip_acceso = '' THEN NULL
            ELSE p_ip_acceso::inet
        END,
        p_user_agent,
        COALESCE(p_tipo_login, 'password')
    )
    RETURNING id_sesion
    INTO v_id_sesion;

    ------------------------------------------------------------------
    -- 9) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok'::text,
        NULL::text,
        'Login exitoso'::text,
        jsonb_build_object(
            'user_id',                     v_user.user_id,
            'email',                       v_user.email,
            'nombre',                      v_user.nombre,
            'apellido',                    v_user.apellido,
            'estado_cuenta',               v_user.estado_cuenta,
            'id_sesion',                   v_id_sesion,

            -- rol único para que el front sepa qué página pintar
            'role',                        v_role_principal,

            -- flags redundantes pero coherentes
            'is_paciente',                 v_is_paciente,
            'is_terapeuta',                v_is_terapeuta,
            'is_admin',                    v_is_admin,
            'is_super_admin',              v_is_super_admin,
            'can_manage_files',            v_can_manage_files,
            'is_accounter',                v_is_accounter,
            'id_usuario_terapeuta_admin',  v_id_usuario_terapeuta_admin
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'INTERNAL_ERROR'::text,
            'Error interno al intentar hacer login'::text,
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;

---

CREATE OR REPLACE FUNCTION terapia.fn_crear_enfoque(
    p_actor_user_id   integer,
    p_id_sesion       integer,
    p_nombre          text,
    p_descripcion     text  DEFAULT NULL,
    p_metadata        jsonb DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_enfoque terapia.enfoque%ROWTYPE;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RETURN QUERY
        SELECT
            'error',
            'MISSING_SESSION',
            'Se requiere id_sesion para registrar el log',
            NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'error',
            'INVALID_SESSION',
            'La sesión no existe, no pertenece al actor o ya fue cerrada',
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) Insertar enfoque
    ------------------------------------------------------------------
    INSERT INTO terapia.enfoque(
        nombre,
        descripcion,
        metadata
    )
    VALUES (
        p_nombre,
        p_descripcion,
        p_metadata
    )
    RETURNING *
    INTO v_enfoque;

    ------------------------------------------------------------------
    -- 2) Registrar log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'CREAR_ENFOQUE',
        'enfoque',
        v_enfoque.id_enfoque,
        jsonb_build_object(
            'id_enfoque',  v_enfoque.id_enfoque,
            'nombre',      v_enfoque.nombre,
            'descripcion', v_enfoque.descripcion,
            'metadata',    v_enfoque.metadata
        )
    );

    ------------------------------------------------------------------
    -- 3) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok',
        NULL::text,
        'Enfoque creado correctamente',
        jsonb_build_object(
            'id_enfoque', v_enfoque.id_enfoque,
            'enfoque',    to_jsonb(v_enfoque)
        );
    RETURN;

EXCEPTION
    WHEN unique_violation THEN
        -- Hay índice único en nombre
        RETURN QUERY
        SELECT
            'error',
            'ENFOQUE_DUPLICATE_NAME',
            'Ya existe un enfoque con ese nombre',
            NULL::jsonb;
        RETURN;

    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error',
            'INTERNAL_ERROR',
            'Error interno al crear enfoque',
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION terapia.fn_crear_producto(
    p_actor_user_id      integer,
    p_id_sesion          integer,
    p_nombre             text,
    p_descripcion        text          DEFAULT NULL,
    p_id_enfoque_default integer       DEFAULT NULL,
    p_duracion_minutos   integer       DEFAULT 50,
    p_precio_base        numeric(12,2) DEFAULT NULL,
    p_costo_base         numeric(12,2) DEFAULT NULL,
    p_categoria          text          DEFAULT NULL,
    p_metadata           jsonb         DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_producto terapia.producto%ROWTYPE;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RETURN QUERY
        SELECT
            'error',
            'MISSING_SESSION',
            'Se requiere id_sesion para registrar el log',
            NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'error',
            'INVALID_SESSION',
            'La sesión no existe, no pertenece al actor o ya fue cerrada',
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) Validaciones básicas
    ------------------------------------------------------------------
    IF p_duracion_minutos IS NULL OR p_duracion_minutos <= 0 THEN
        RETURN QUERY
        SELECT
            'error',
            'INVALID_DURATION',
            'La duración en minutos debe ser mayor a 0',
            NULL::jsonb;
        RETURN;
    END IF;

    IF p_id_enfoque_default IS NOT NULL THEN
        PERFORM 1
        FROM terapia.enfoque e
        WHERE e.id_enfoque = p_id_enfoque_default
          AND e.register_status = 'Activo';

        IF NOT FOUND THEN
            RETURN QUERY
            SELECT
                'error',
                'ENFOQUE_NOT_FOUND',
                'El id_enfoque_default no corresponde a un enfoque activo',
                NULL::jsonb;
            RETURN;
        END IF;
    END IF;

    ------------------------------------------------------------------
    -- 2) Insertar producto
    ------------------------------------------------------------------
    INSERT INTO terapia.producto(
        nombre,
        descripcion,
        id_enfoque_default,
        duracion_minutos,
        precio_base,
        costo_base,
        categoria,
        metadata
    )
    VALUES (
        p_nombre,
        p_descripcion,
        p_id_enfoque_default,
        p_duracion_minutos,
        p_precio_base,
        p_costo_base,
        p_categoria,
        p_metadata
    )
    RETURNING *
    INTO v_producto;

    ------------------------------------------------------------------
    -- 3) Registrar log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'CREAR_PRODUCTO',
        'producto',
        v_producto.id_producto,
        jsonb_build_object(
            'id_producto',        v_producto.id_producto,
            'nombre',             v_producto.nombre,
            'id_enfoque_default', v_producto.id_enfoque_default,
            'duracion_minutos',   v_producto.duracion_minutos,
            'precio_base',        v_producto.precio_base,
            'costo_base',         v_producto.costo_base,
            'categoria',          v_producto.categoria,
            'metadata',           v_producto.metadata
        )
    );

    ------------------------------------------------------------------
    -- 4) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok',
        NULL::text,
        'Producto creado correctamente',
        jsonb_build_object(
            'id_producto', v_producto.id_producto,
            'producto',    to_jsonb(v_producto)
        );
    RETURN;

EXCEPTION
    WHEN foreign_key_violation THEN
        RETURN QUERY
        SELECT
            'error',
            'FOREIGN_KEY_VIOLATION',
            'Error de clave foránea (revisa id_enfoque_default u otras referencias)',
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;

    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error',
            'INTERNAL_ERROR',
            'Error interno al crear producto',
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION terapia.fn_crear_horario_terapeuta(
    p_actor_user_id        integer,
    p_id_sesion            integer,
    p_id_usuario_terapeuta integer,
    p_dia_semana           smallint,
    p_hora_inicio          time,
    p_hora_fin             time,
    p_tipo_atencion        text  DEFAULT NULL,
    p_canal                text  DEFAULT NULL,
    p_ubicacion            text  DEFAULT NULL,
    p_metadata             jsonb DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_terapeuta usuarios.usuario_terapeuta%ROWTYPE;
    v_horario   terapia.horario_terapeuta%ROWTYPE;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RETURN QUERY
        SELECT
            'error',
            'MISSING_SESSION',
            'Se requiere id_sesion para registrar el log',
            NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'error',
            'INVALID_SESSION',
            'La sesión no existe, no pertenece al actor o ya fue cerrada',
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) Validar terapeuta objetivo
    ------------------------------------------------------------------
    SELECT *
    INTO v_terapeuta
    FROM usuarios.usuario_terapeuta ut
    WHERE ut.user_id = p_id_usuario_terapeuta
      AND ut.register_status = 'Activo';

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'error',
            'TERAPEUTA_NOT_FOUND',
            'El id_usuario_terapeuta no corresponde a un terapeuta activo',
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Validaciones de rango (además de los CHECK de la tabla)
    ------------------------------------------------------------------
    IF p_dia_semana NOT BETWEEN 1 AND 7 THEN
        RETURN QUERY
        SELECT
            'error',
            'INVALID_DIA_SEMANA',
            'dia_semana debe estar entre 1 (lunes) y 7 (domingo)',
            NULL::jsonb;
        RETURN;
    END IF;

    IF p_hora_fin <= p_hora_inicio THEN
        RETURN QUERY
        SELECT
            'error',
            'INVALID_TIME_RANGE',
            'hora_fin debe ser mayor a hora_inicio',
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Insertar horario
    ------------------------------------------------------------------
    INSERT INTO terapia.horario_terapeuta(
        id_usuario_terapeuta,
        dia_semana,
        hora_inicio,
        hora_fin,
        tipo_atencion,
        canal,
        ubicacion,
        metadata
    )
    VALUES (
        p_id_usuario_terapeuta,
        p_dia_semana,
        p_hora_inicio,
        p_hora_fin,
        p_tipo_atencion,
        p_canal,
        p_ubicacion,
        p_metadata
    )
    RETURNING *
    INTO v_horario;

    ------------------------------------------------------------------
    -- 4) Registrar log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'CREAR_HORARIO_TERAPEUTA',
        'horario_terapeuta',
        v_horario.id_horario_terapeuta,
        jsonb_build_object(
            'id_horario_terapeuta', v_horario.id_horario_terapeuta,
            'id_usuario_terapeuta', v_horario.id_usuario_terapeuta,
            'dia_semana',           v_horario.dia_semana,
            'hora_inicio',          v_horario.hora_inicio,
            'hora_fin',             v_horario.hora_fin,
            'tipo_atencion',        v_horario.tipo_atencion,
            'canal',                v_horario.canal,
            'ubicacion',            v_horario.ubicacion,
            'metadata',             v_horario.metadata
        )
    );

    ------------------------------------------------------------------
    -- 5) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok',
        NULL::text,
        'Horario de terapeuta creado correctamente',
        jsonb_build_object(
            'id_horario_terapeuta', v_horario.id_horario_terapeuta,
            'horario',              to_jsonb(v_horario)
        );
    RETURN;

EXCEPTION
    WHEN unique_violation THEN
        -- Único: id_usuario_terapeuta, dia_semana, hora_inicio, hora_fin
        RETURN QUERY
        SELECT
            'error',
            'HORARIO_DUPLICATE_SLOT',
            'Ya existe un horario idéntico para ese terapeuta, día y rango horario',
            NULL::jsonb;
        RETURN;

    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error',
            'INTERNAL_ERROR',
            'Error interno al crear horario de terapeuta',
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;



CREATE OR REPLACE FUNCTION terapia.fn_crear_bloqueo_agenda(
    p_actor_user_id        integer,
    p_id_sesion            integer,

    p_id_usuario_terapeuta integer,
    p_inicio               timestamptz,
    p_fin                  timestamptz,

    p_tipo_bloqueo         text,
    p_motivo               text DEFAULT NULL,
    p_metadata             jsonb DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_terapeuta usuarios.usuario_terapeuta%rowtype;
    v_bloqueo   terapia.bloqueo_agenda%rowtype;
    v_cita      terapia.cita%rowtype;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RETURN QUERY
        SELECT 'error', 'MISSING_SESSION', 'Se requiere una sesión activa (id_sesion).', NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error', 'INVALID_SESSION',
               'La sesión no existe, no pertenece al actor o ya fue cerrada.',
               NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) Validar terapeuta objetivo
    ------------------------------------------------------------------
    SELECT *
    INTO v_terapeuta
    FROM usuarios.usuario_terapeuta ut
    WHERE ut.user_id = p_id_usuario_terapeuta
      AND ut.register_status = 'Activo';

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error', 'TERAPEUTA_NOT_FOUND',
               'El id_usuario_terapeuta no corresponde a un terapeuta activo.',
               NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Validaciones de rango / inputs
    ------------------------------------------------------------------
    IF p_inicio IS NULL OR p_fin IS NULL THEN
        RETURN QUERY
        SELECT 'error', 'INVALID_TIME_RANGE',
               'inicio y fin son obligatorios.',
               NULL::jsonb;
        RETURN;
    END IF;

    IF p_fin <= p_inicio THEN
        RETURN QUERY
        SELECT 'error', 'INVALID_TIME_RANGE',
               'fin debe ser mayor que inicio.',
               NULL::jsonb;
        RETURN;
    END IF;

    IF p_tipo_bloqueo IS NULL OR btrim(p_tipo_bloqueo) = '' THEN
        RETURN QUERY
        SELECT 'error', 'INVALID_TIPO_BLOQUEO',
               'tipo_bloqueo es obligatorio.',
               NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Validar solape con citas activas
    ------------------------------------------------------------------
    SELECT *
    INTO v_cita
    FROM terapia.cita c
    WHERE c.id_usuario_terapeuta = p_id_usuario_terapeuta
      AND c.register_status = 'Activo'
      AND COALESCE(c.estado,'') NOT IN ('Cancelada','Cancelado')
      AND c.inicio < p_fin
      AND c.fin    > p_inicio
    ORDER BY c.inicio
    LIMIT 1;

    IF FOUND THEN
        RETURN QUERY
        SELECT
            'error',
            'CITA_OVERLAP',
            'Existe al menos una cita activa que se solapa con el rango indicado.',
            jsonb_build_object(
                'conflict', jsonb_build_object(
                    'id_cita', v_cita.id_cita,
                    'inicio',  v_cita.inicio,
                    'fin',     v_cita.fin,
                    'estado',  v_cita.estado
                )
            );
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) Validar solape con otros bloqueos activos
    ------------------------------------------------------------------
    PERFORM 1
    FROM terapia.bloqueo_agenda b
    WHERE b.id_usuario_terapeuta = p_id_usuario_terapeuta
      AND b.register_status = 'Activo'
      AND b.inicio < p_fin
      AND b.fin    > p_inicio;

    IF FOUND THEN
        RETURN QUERY
        SELECT
            'error',
            'BLOQUEO_OVERLAP',
            'Ya existe un bloqueo activo que se solapa con el rango indicado.',
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 5) Insertar bloqueo
    ------------------------------------------------------------------
    INSERT INTO terapia.bloqueo_agenda(
        id_usuario_terapeuta,
        inicio,
        fin,
        tipo_bloqueo,
        motivo
    )
    VALUES (
        p_id_usuario_terapeuta,
        p_inicio,
        p_fin,
        p_tipo_bloqueo,
        p_motivo
    )
    RETURNING *
    INTO v_bloqueo;

    ------------------------------------------------------------------
    -- 6) Registrar log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'CREAR_BLOQUEO_AGENDA',
        'bloqueo_agenda',
        v_bloqueo.id_bloqueo,
        jsonb_build_object(
            'id_bloqueo',           v_bloqueo.id_bloqueo,
            'id_usuario_terapeuta', v_bloqueo.id_usuario_terapeuta,
            'inicio',               v_bloqueo.inicio,
            'fin',                  v_bloqueo.fin,
            'tipo_bloqueo',         v_bloqueo.tipo_bloqueo,
            'motivo',               v_bloqueo.motivo,
            'metadata',             p_metadata
        )
    );

    ------------------------------------------------------------------
    -- 7) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok',
        NULL::text,
        'Bloqueo de agenda creado correctamente.',
        jsonb_build_object(
            'id_bloqueo', v_bloqueo.id_bloqueo,
            'inicio',     v_bloqueo.inicio,
            'fin',        v_bloqueo.fin
        );

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error',
            'INTERNAL_ERROR',
            SQLERRM,
            NULL::jsonb;
END;
$$;


/* -----------------------------------------------------------------------------
   FUNCIÓN: filtrar por terapeuta (retorna los slots de la VIEW)
----------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION terapia.obtener_horarios_disponibles_2_semanas(
    p_id_usuario_terapeuta integer
)
RETURNS TABLE (
    id_usuario_terapeuta   integer,
    id_horario_terapeuta   integer,
    fecha                  date,
    inicio                 timestamptz,
    fin                    timestamptz,
    duracion_minutos       integer,
    tipo_atencion          text,
    canal                  text,
    ubicacion              text,
    metadata               jsonb
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        v.id_usuario_terapeuta,
        v.id_horario_terapeuta,
        v.fecha,
        v.inicio,
        v.fin,
        v.duracion_minutos,
        v.tipo_atencion,
        v.canal,
        v.ubicacion,
        v.metadata
    FROM terapia.v_horarios_disponibles_2_semanas v
    WHERE v.id_usuario_terapeuta = p_id_usuario_terapeuta
    ORDER BY v.inicio;
$$;


CREATE OR REPLACE FUNCTION terapia.fn_registrar_cita(
    p_actor_user_id         integer,
    p_id_sesion             integer,

    p_id_producto           integer,
    p_id_usuario_terapeuta  integer,
    p_id_usuario_paciente   integer,

    p_inicio                timestamptz,
    p_fin                   timestamptz DEFAULT NULL,

    p_id_enfoque            integer     DEFAULT NULL,
    p_canal                 text        DEFAULT NULL,
    p_enlace_sesion         text        DEFAULT NULL,
    p_direccion             text        DEFAULT NULL,
    p_notas_internas        text        DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_cita          terapia.cita%ROWTYPE;
    v_producto      terapia.producto%ROWTYPE;

    v_fin           timestamptz;
    v_duracion      integer;

    v_dia           integer;
    v_ini_time      time;
    v_fin_time      time;

    v_is_admin      boolean;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RETURN QUERY SELECT 'error','MISSING_SESSION','Se requiere id_sesion para registrar el log',NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','La sesión no existe, no pertenece al actor o ya fue cerrada',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) Validaciones base (producto/roles)
    ------------------------------------------------------------------
    SELECT *
    INTO v_producto
    FROM terapia.producto pr
    WHERE pr.id_producto = p_id_producto
      AND pr.register_status = 'Activo';

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','PRODUCT_NOT_FOUND','Producto no existe o no está activo',NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM usuarios.usuario_terapeuta t
    WHERE t.user_id = p_id_usuario_terapeuta
      AND t.register_status = 'Activo';

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','TERAPEUTA_NOT_FOUND','Terapeuta no existe o no está activo',NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM usuarios.usuario_paciente p
    WHERE p.user_id = p_id_usuario_paciente
      AND p.register_status = 'Activo';

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','PACIENTE_NOT_FOUND','Paciente no existe o no está activo',NULL::jsonb;
        RETURN;
    END IF;

    -- autorización mínima: paciente dueño o admin/coordinador
    v_is_admin := EXISTS(
        SELECT 1
        FROM usuarios.usuario_admin a
        WHERE a.user_id = p_actor_user_id
          AND a.register_status = 'Activo'
    );

    IF (p_actor_user_id <> p_id_usuario_paciente) AND (NOT v_is_admin) THEN
        RETURN QUERY SELECT 'error','NOT_ALLOWED','Solo el paciente dueño o un admin puede registrar la cita',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Calcular/validar rango horario
    ------------------------------------------------------------------
    v_duracion := COALESCE(v_producto.duracion_minutos, 50);

    IF p_fin IS NULL THEN
        v_fin := p_inicio + make_interval(mins => v_duracion);
    ELSE
        v_fin := p_fin;
        IF (v_fin - p_inicio) <> make_interval(mins => v_duracion) THEN
            RETURN QUERY
            SELECT 'error','DURATION_MISMATCH',
                   'El rango inicio/fin no coincide con la duración del producto',
                   jsonb_build_object(
                       'duracion_minutos', v_duracion,
                       'inicio', p_inicio,
                       'fin', v_fin
                   );
            RETURN;
        END IF;
    END IF;

    IF v_fin <= p_inicio THEN
        RETURN QUERY SELECT 'error','INVALID_TIME_RANGE','El fin debe ser mayor al inicio',NULL::jsonb;
        RETURN;
    END IF;

    IF (p_inicio::date <> v_fin::date) THEN
        RETURN QUERY SELECT 'error','INVALID_TIME_RANGE','La cita no puede cruzar de día (inicio/fin deben ser la misma fecha)',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Validar que cae dentro del horario del terapeuta
    ------------------------------------------------------------------
    v_dia      := EXTRACT(ISODOW FROM p_inicio)::int;  -- 1=lun ... 7=dom
    v_ini_time := p_inicio::time;
    v_fin_time := v_fin::time;

    PERFORM 1
    FROM terapia.horario_terapeuta h
    WHERE h.id_usuario_terapeuta = p_id_usuario_terapeuta
      AND h.register_status = 'Activo'
      AND h.es_laboral = true
      AND h.dia_semana = v_dia
      AND v_ini_time >= h.hora_inicio
      AND v_fin_time <= h.hora_fin;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error','OUTSIDE_SCHEDULE',
               'El rango no está dentro del horario laboral del terapeuta',
               jsonb_build_object('dia_semana', v_dia, 'inicio', p_inicio, 'fin', v_fin);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) Validar solapes (bloqueos y otras citas activas)
    ------------------------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM terapia.bloqueo_agenda b
        WHERE b.id_usuario_terapeuta = p_id_usuario_terapeuta
          AND b.register_status = 'Activo'
          AND (p_inicio, v_fin) OVERLAPS (b.inicio, b.fin)
    ) THEN
        RETURN QUERY
        SELECT 'error','BLOQUEO_OVERLAP',
               'Existe al menos un bloqueo activo que se solapa con el rango indicado',
               NULL::jsonb;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM terapia.cita c
        WHERE c.id_usuario_terapeuta = p_id_usuario_terapeuta
          AND c.register_status = 'Activo'
          AND COALESCE(c.estado,'') <> 'Cancelada'
          AND (p_inicio, v_fin) OVERLAPS (c.inicio, c.fin)
    ) THEN
        RETURN QUERY
        SELECT 'error','CITA_OVERLAP',
               'Existe al menos una cita activa que se solapa con el rango indicado',
               NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 5) Insertar cita (FORZADA A 'Pendiente')
    ------------------------------------------------------------------
    INSERT INTO terapia.cita(
        id_producto,
        id_enfoque,
        id_usuario_terapeuta,
        id_usuario_paciente,
        id_usuario_coordinador,
        fecha_programada,
        inicio,
        fin,
        canal,
        enlace_sesion,
        direccion,
        estado,
        notas_internas
    )
    VALUES (
        p_id_producto,
        COALESCE(p_id_enfoque, v_producto.id_enfoque_default),
        p_id_usuario_terapeuta,
        p_id_usuario_paciente,
        CASE WHEN v_is_admin THEN p_actor_user_id ELSE NULL END,
        (p_inicio::date),
        p_inicio,
        v_fin,
        p_canal,
        p_enlace_sesion,
        p_direccion,
        'Pendiente',
        p_notas_internas
    )
    RETURNING *
    INTO v_cita;

    -- Asegurar que quedó realmente 'Pendiente'
    IF v_cita.estado IS DISTINCT FROM 'Pendiente' THEN
        RETURN QUERY
        SELECT 'error','INTERNAL_ERROR','La cita no quedó en estado Pendiente (revisar defaults/triggers)',to_jsonb(v_cita);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 6) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'CREAR_CITA',
        'cita',
        v_cita.id_cita,
        jsonb_build_object(
            'id_cita', v_cita.id_cita,
            'estado',  v_cita.estado,
            'id_usuario_terapeuta', v_cita.id_usuario_terapeuta,
            'id_usuario_paciente',  v_cita.id_usuario_paciente,
            'inicio',  v_cita.inicio,
            'fin',     v_cita.fin,
            'id_producto', v_cita.id_producto
        )
    );

    ------------------------------------------------------------------
    -- 7) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok',
        NULL::text,
        'Cita registrada en estado Pendiente',
        jsonb_build_object(
            'id_cita', v_cita.id_cita,
            'cita',    to_jsonb(v_cita)
        );
    RETURN;

EXCEPTION
    WHEN foreign_key_violation THEN
        RETURN QUERY
        SELECT 'error','FOREIGN_KEY_VIOLATION',
               'Error de clave foránea (revisa ids enviados)',
               jsonb_build_object('error_message', SQLERRM, 'error_code', SQLSTATE);
        RETURN;

    WHEN OTHERS THEN
        RETURN QUERY
        SELECT 'error','INTERNAL_ERROR',
               'Error interno al registrar cita',
               jsonb_build_object('error_message', SQLERRM, 'error_code', SQLSTATE);
        RETURN;
END;
$$;


/* ---------------------------------------------------------------------------
   3) FUNCIÓN: UPDATE CITA (confirmar / cancelar) + LOG
--------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION terapia.fn_actualizar_detalle_cita(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_id_cita       integer,
    p_patch         jsonb,
    p_motivo        text DEFAULT NULL
)
RETURNS TABLE(status text, type_error text, message text, data jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
    v_allowed text[] := ARRAY[
        'id_enfoque','fecha_programada','inicio','fin',
        'canal','enlace_sesion','direccion','notas_internas'
    ];

    v_now        timestamptz := now();
    v_cita_old   terapia.cita%ROWTYPE;
    v_cita_new   terapia.cita%ROWTYPE;

    v_is_admin   boolean := false;
    v_is_super   boolean := false;

    v_inicio_new timestamptz;
    v_fin_new    timestamptz;
    v_fecha_new  date;

    v_deadline   timestamptz;
    v_time_left  interval;

    v_f          text;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1
        FROM seguridad.sesion s
        WHERE s.id_sesion = p_id_sesion
          AND s.user_id   = p_actor_user_id
          AND s.register_status = 'Activo'
          AND s.timestamp_logout IS NULL
    ) THEN
        RETURN QUERY
        SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) Validar patch
    ------------------------------------------------------------------
    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RETURN QUERY
        SELECT 'error','INVALID_PATCH','p_patch debe ser un JSON object',NULL::jsonb;
        RETURN;
    END IF;

    IF (SELECT COUNT(*) FROM jsonb_object_keys(p_patch)) = 0 THEN
        RETURN QUERY
        SELECT 'error','EMPTY_PATCH','No hay campos para modificar',NULL::jsonb;
        RETURN;
    END IF;

    FOR v_f IN SELECT key FROM jsonb_object_keys(p_patch) AS t(key)
    LOOP
        IF NOT (v_f = ANY(v_allowed)) THEN
            RETURN QUERY
            SELECT 'error','FIELD_NOT_ALLOWED',
                   'Campo no permitido en patch',
                   jsonb_build_object('field', v_f, 'allowed', v_allowed);
            RETURN;
        END IF;
    END LOOP;

    ------------------------------------------------------------------
    -- 2) Cargar cita
    ------------------------------------------------------------------
    SELECT *
    INTO v_cita_old
    FROM terapia.cita c
    WHERE c.id_cita = p_id_cita
      AND c.register_status = 'Activo';

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error','CITA_NOT_FOUND','Cita no encontrada',jsonb_build_object('id_cita', p_id_cita);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Rol admin/super
    ------------------------------------------------------------------
    SELECT true, COALESCE(a.is_super_admin,false)
    INTO v_is_admin, v_is_super
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo'
    LIMIT 1;

    IF v_is_admin IS NULL THEN
        v_is_admin := false;
        v_is_super := false;
    END IF;

    ------------------------------------------------------------------
    -- 4) Permisos
    --    (terapeuta dueño o admin)
    ------------------------------------------------------------------
    IF NOT v_is_admin AND p_actor_user_id <> v_cita_old.id_usuario_terapeuta THEN
        RETURN QUERY
        SELECT 'error','FORBIDDEN','Solo el terapeuta asignado o un admin puede editar la cita',
               jsonb_build_object('id_cita', v_cita_old.id_cita);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 5) Reglas de estado + ventana de edición
    ------------------------------------------------------------------
    IF COALESCE(v_cita_old.estado,'') IN ('Cancelada','Realizada') THEN
        RETURN QUERY
        SELECT 'error','CITA_NOT_EDITABLE','No se puede editar una cita cancelada o realizada',
               jsonb_build_object('estado', v_cita_old.estado);
        RETURN;
    END IF;

    v_time_left := v_cita_old.inicio - v_now;
    v_deadline  := v_cita_old.inicio - interval '1 day';

    -- CORRECCIÓN: antes estaba al revés. Ahora se bloquea si falta < 1 día.
    IF NOT v_is_super THEN
        IF v_now >= v_cita_old.inicio THEN
            RETURN QUERY
            SELECT 'error','CITA_ALREADY_STARTED','No se puede editar una cita que ya inició',
                   jsonb_build_object('inicio', v_cita_old.inicio, 'now', v_now);
            RETURN;
        END IF;

        IF v_time_left < interval '1 day' THEN
            RETURN QUERY
            SELECT 'error','EDIT_WINDOW_CLOSED',
                   'No se puede editar: falta menos de 1 día para la cita',
                   jsonb_build_object('deadline', v_deadline, 'inicio', v_cita_old.inicio, 'now', v_now);
            RETURN;
        END IF;
    END IF;

    ------------------------------------------------------------------
    -- 6) Calcular nuevos valores (coalesce patch vs old)
    ------------------------------------------------------------------
    v_inicio_new :=
        CASE WHEN (p_patch ? 'inicio') AND jsonb_typeof(p_patch->'inicio') <> 'null'
             THEN (p_patch->>'inicio')::timestamptz
             ELSE v_cita_old.inicio
        END;

    v_fin_new :=
        CASE WHEN (p_patch ? 'fin') AND jsonb_typeof(p_patch->'fin') <> 'null'
             THEN (p_patch->>'fin')::timestamptz
             ELSE v_cita_old.fin
        END;

    IF v_fin_new <= v_inicio_new THEN
        RETURN QUERY
        SELECT 'error','RANGO_INVALIDO','fin debe ser mayor que inicio',
               jsonb_build_object('inicio', v_inicio_new, 'fin', v_fin_new);
        RETURN;
    END IF;

    -- fecha_programada: si viene explícita, se respeta PERO debe coincidir con la fecha del inicio.
    v_fecha_new :=
        CASE WHEN (p_patch ? 'fecha_programada') AND jsonb_typeof(p_patch->'fecha_programada') <> 'null'
             THEN (p_patch->>'fecha_programada')::date
             ELSE (v_inicio_new AT TIME ZONE 'America/La_Paz')::date
        END;

    IF v_fecha_new <> (v_inicio_new AT TIME ZONE 'America/La_Paz')::date THEN
        RETURN QUERY
        SELECT 'error','FECHA_INCONSISTENTE',
               'fecha_programada debe coincidir con la fecha de inicio (zona America/La_Paz)',
               jsonb_build_object(
                   'fecha_programada', v_fecha_new,
                   'fecha_de_inicio', (v_inicio_new AT TIME ZONE 'America/La_Paz')::date
               );
        RETURN;
    END IF;

    -- Validar enfoque si llega
    IF (p_patch ? 'id_enfoque') AND jsonb_typeof(p_patch->'id_enfoque') <> 'null' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM terapia.enfoque e
            WHERE e.id_enfoque = (p_patch->>'id_enfoque')::int
              AND e.register_status = 'Activo'
        ) THEN
            RETURN QUERY
            SELECT 'error','ENFOQUE_NOT_FOUND','El enfoque indicado no existe o no está activo',
                   jsonb_build_object('id_enfoque', (p_patch->>'id_enfoque')::int);
            RETURN;
        END IF;
    END IF;

    ------------------------------------------------------------------
    -- 7) Validar solapes (citas activas + bloqueos agenda)
    ------------------------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM terapia.cita c
        WHERE c.id_usuario_terapeuta = v_cita_old.id_usuario_terapeuta
          AND c.register_status = 'Activo'
          AND c.id_cita <> v_cita_old.id_cita
          AND COALESCE(c.estado,'') <> 'Cancelada'
          AND (v_inicio_new < c.fin AND v_fin_new > c.inicio)
    ) THEN
        RETURN QUERY
        SELECT 'error','CITA_OVERLAP',
               'Existe al menos una cita activa que se solapa con el rango indicado',
               jsonb_build_object('inicio', v_inicio_new, 'fin', v_fin_new);
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM terapia.bloqueo_agenda b
        WHERE b.id_usuario_terapeuta = v_cita_old.id_usuario_terapeuta
          AND b.register_status = 'Activo'
          AND (v_inicio_new < b.fin AND v_fin_new > b.inicio)
    ) THEN
        RETURN QUERY
        SELECT 'error','BLOQUEO_OVERLAP',
               'El rango se solapa con un bloqueo de agenda del terapeuta',
               jsonb_build_object('inicio', v_inicio_new, 'fin', v_fin_new);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 8) UPDATE
    ------------------------------------------------------------------
    UPDATE terapia.cita c
    SET
        id_enfoque = CASE WHEN (p_patch ? 'id_enfoque') AND jsonb_typeof(p_patch->'id_enfoque') <> 'null'
                          THEN (p_patch->>'id_enfoque')::int ELSE c.id_enfoque END,

        fecha_programada = v_fecha_new,
        inicio           = v_inicio_new,
        fin              = v_fin_new,

        canal            = CASE WHEN (p_patch ? 'canal') AND jsonb_typeof(p_patch->'canal') <> 'null'
                                THEN (p_patch->>'canal') ELSE c.canal END,

        enlace_sesion    = CASE WHEN (p_patch ? 'enlace_sesion') AND jsonb_typeof(p_patch->'enlace_sesion') <> 'null'
                                THEN (p_patch->>'enlace_sesion') ELSE c.enlace_sesion END,

        direccion        = CASE WHEN (p_patch ? 'direccion') AND jsonb_typeof(p_patch->'direccion') <> 'null'
                                THEN (p_patch->>'direccion') ELSE c.direccion END,

        notas_internas   = CASE WHEN (p_patch ? 'notas_internas') AND jsonb_typeof(p_patch->'notas_internas') <> 'null'
                                THEN (p_patch->>'notas_internas') ELSE c.notas_internas END,

        motivo_modificacion = COALESCE(NULLIF(btrim(p_motivo),''), 'Edición de cita')
    WHERE c.id_cita = p_id_cita
    RETURNING * INTO v_cita_new;

    ------------------------------------------------------------------
    -- 9) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion, user_id, tipo_accion, tipo_contenedor, id_contenedor, detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'UPDATE_CITA_DETALLE',
        'cita',
        v_cita_new.id_cita,
        jsonb_build_object(
            'old', to_jsonb(v_cita_old),
            'new', to_jsonb(v_cita_new),
            'deadline', v_deadline,
            'time_left', v_time_left,
            'motivo', p_motivo
        )
    );

    RETURN QUERY
    SELECT 'ok', NULL::text, 'Cita modificada correctamente',
           jsonb_build_object('id_cita', v_cita_new.id_cita, 'cita', to_jsonb(v_cita_new));
    RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION terapia.fn_listar_solicitudes_cita_admin(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_limit         integer DEFAULT 50,
    p_offset        integer DEFAULT 0
)
RETURNS SETOF terapia.vw_resumen_solicitudes_cita
LANGUAGE plpgsql
AS
$$
DECLARE
    v_limit      integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
    v_offset     integer := GREATEST(COALESCE(p_offset, 0), 0);

    v_terapeuta_id integer;
    v_total_count  integer := 0;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión (actor)
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RAISE EXCEPTION 'MISSING_SESSION';
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SESSION';
    END IF;

    ------------------------------------------------------------------
    -- 1) Admin -> terapeuta asignado (un admin gestiona 1 terapeuta)
    ------------------------------------------------------------------
    SELECT a.id_usuario_terapeuta
    INTO v_terapeuta_id
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo';

    IF v_terapeuta_id IS NULL THEN
        RAISE EXCEPTION 'ADMIN_WITHOUT_TERAPEUTA';
    END IF;

    ------------------------------------------------------------------
    -- 2) Total (para log)
    ------------------------------------------------------------------
    SELECT COUNT(*)
    INTO v_total_count
    FROM terapia.vw_resumen_solicitudes_cita v
    WHERE v.id_usuario_terapeuta = v_terapeuta_id;

    ------------------------------------------------------------------
    -- 3) Log (una sola vez)
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'LISTAR_SOLICITUDES_CITA',
        'cita',
        NULL,
        jsonb_build_object(
            'admin_user_id', p_actor_user_id,
            'scope_id_usuario_terapeuta', v_terapeuta_id,
            'limit', v_limit,
            'offset', v_offset,
            'total_count', v_total_count
        )
    );

    ------------------------------------------------------------------
    -- 4) Retornar filas de la VIEW filtradas por el terapeuta del admin
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT *
    FROM terapia.vw_resumen_solicitudes_cita v
    WHERE v.id_usuario_terapeuta = v_terapeuta_id
    ORDER BY v.created_at DESC
    LIMIT v_limit
    OFFSET v_offset;

END;
$$;

CREATE OR REPLACE FUNCTION terapia.fn_actualizar_detalle_cita(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_id_cita       integer,
    p_patch         jsonb,
    p_motivo        text DEFAULT NULL
)
RETURNS TABLE(status text, type_error text, message text, data jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
    v_allowed text[] := ARRAY[
        'id_enfoque','fecha_programada','inicio','fin',
        'canal','enlace_sesion','direccion','notas_internas'
    ];

    v_cita_old terapia.cita%ROWTYPE;
    v_cita_new terapia.cita%ROWTYPE;

    v_deadline timestamptz;

    v_is_admin boolean := false;
    v_is_super boolean := false;
    v_admin_terapeuta integer;

    v_inicio_new timestamptz;
    v_fin_new timestamptz;
    v_fecha_new date;

    v_changed jsonb := '{}'::jsonb;
    v_kept    jsonb := '{}'::jsonb;
    v_has_change boolean := false;
    v_f text;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RETURN QUERY SELECT 'error','MISSING_SESSION','Se requiere id_sesion para registrar el log',NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','La sesión no existe, no pertenece al actor o ya fue cerrada',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) Validar patch
    ------------------------------------------------------------------
    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RETURN QUERY SELECT 'error','INVALID_PATCH','p_patch debe ser un JSON object',NULL::jsonb;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_patch) k
        WHERE k <> ALL(v_allowed)
    ) THEN
        RETURN QUERY
        SELECT 'error','PATCH_NOT_ALLOWED','p_patch contiene campos no permitidos',
               jsonb_build_object('allowed', v_allowed);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Cargar cita (lock)
    ------------------------------------------------------------------
    SELECT *
    INTO v_cita_old
    FROM terapia.cita c
    WHERE c.id_cita = p_id_cita
      AND c.register_status = 'Activo'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','CITA_NOT_FOUND','La cita no existe o no está activa',NULL::jsonb;
        RETURN;
    END IF;

    IF COALESCE(v_cita_old.estado,'') = 'Cancelada' THEN
        RETURN QUERY SELECT 'error','CITA_CANCELADA','No se puede editar una cita cancelada',to_jsonb(v_cita_old);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Ventana de modificación: solo hasta 1 día antes del inicio actual
    ------------------------------------------------------------------
    v_deadline := v_cita_old.inicio - interval '1 day';
    IF now() > v_deadline THEN
        RETURN QUERY
        SELECT
            'error','MODIFICATION_WINDOW_CLOSED',
            'Solo se permite modificar la cita hasta 1 día antes del inicio',
            jsonb_build_object('id_cita',p_id_cita,'inicio',v_cita_old.inicio,'deadline',v_deadline,'now',now());
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) Autorizar (dueños o admin asignado/super)
    ------------------------------------------------------------------
    SELECT true, COALESCE(a.is_super_admin,false), a.id_usuario_terapeuta
    INTO v_is_admin, v_is_super, v_admin_terapeuta
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo'
    LIMIT 1;

    IF NOT FOUND THEN
        v_is_admin := false;
        v_is_super := false;
        v_admin_terapeuta := NULL;
    END IF;

    IF (p_actor_user_id <> v_cita_old.id_usuario_paciente)
       AND (p_actor_user_id <> v_cita_old.id_usuario_terapeuta)
       AND NOT (v_is_admin AND (v_is_super OR v_admin_terapeuta = v_cita_old.id_usuario_terapeuta)) THEN
        RETURN QUERY SELECT 'error','NOT_ALLOWED','No tienes permisos para modificar esta cita',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 5) Armar kept/changed (NULL/ausente => conservar)
    ------------------------------------------------------------------
    FOREACH v_f IN ARRAY v_allowed LOOP
        IF (p_patch ? v_f) AND jsonb_typeof(p_patch->v_f) <> 'null' THEN
            v_changed := v_changed || jsonb_build_object(v_f, p_patch->v_f);
            v_has_change := true;
        ELSE
            v_kept := v_kept || jsonb_build_object(v_f, to_jsonb(v_cita_old)->v_f);
        END IF;
    END LOOP;

    IF NOT v_has_change THEN
        RETURN QUERY SELECT 'error','NO_CHANGES','No hay campos nuevos (no-null) para actualizar',jsonb_build_object('patch',p_patch);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 6) Calcular valores finales para validar rango/solapes
    ------------------------------------------------------------------
    v_inicio_new :=
        CASE WHEN (p_patch ? 'inicio') AND jsonb_typeof(p_patch->'inicio') <> 'null'
             THEN (p_patch->>'inicio')::timestamptz
             ELSE v_cita_old.inicio END;

    v_fin_new :=
        CASE WHEN (p_patch ? 'fin') AND jsonb_typeof(p_patch->'fin') <> 'null'
             THEN (p_patch->>'fin')::timestamptz
             ELSE v_cita_old.fin END;

    IF v_fin_new <= v_inicio_new THEN
        RETURN QUERY
        SELECT 'error','INVALID_RANGE','El rango es inválido (fin debe ser mayor que inicio)',
               jsonb_build_object('inicio',v_inicio_new,'fin',v_fin_new);
        RETURN;
    END IF;

    -- fecha_programada: si no viene y cambias inicio, la recalculo automáticamente
    v_fecha_new :=
        CASE
            WHEN (p_patch ? 'fecha_programada') AND jsonb_typeof(p_patch->'fecha_programada') <> 'null'
                THEN (p_patch->>'fecha_programada')::date
            WHEN v_inicio_new <> v_cita_old.inicio
                THEN (v_inicio_new::date)
            ELSE
                v_cita_old.fecha_programada
        END;

    -- validar enfoque si se cambia
    IF (p_patch ? 'id_enfoque') AND jsonb_typeof(p_patch->'id_enfoque') <> 'null' THEN
        PERFORM 1
        FROM terapia.enfoque e
        WHERE e.id_enfoque = (p_patch->>'id_enfoque')::int
          AND e.register_status = 'Activo';

        IF NOT FOUND THEN
            RETURN QUERY
            SELECT 'error','ENFOQUE_NOT_FOUND','El enfoque indicado no existe o no está activo',
                   jsonb_build_object('id_enfoque',(p_patch->>'id_enfoque')::int);
            RETURN;
        END IF;
    END IF;

    ------------------------------------------------------------------
    -- 7) Validar solapes (citas activas + bloqueos agenda)
    ------------------------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM terapia.cita c
        WHERE c.id_usuario_terapeuta = v_cita_old.id_usuario_terapeuta
          AND c.register_status = 'Activo'
          AND c.id_cita <> v_cita_old.id_cita
          AND COALESCE(c.estado,'') <> 'Cancelada'
          AND (v_inicio_new < c.fin AND v_fin_new > c.inicio)
    ) THEN
        RETURN QUERY
        SELECT 'error','CITA_OVERLAP','Existe al menos una cita activa que se solapa con el rango indicado',
               jsonb_build_object('inicio',v_inicio_new,'fin',v_fin_new);
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM terapia.bloqueo_agenda b
        WHERE b.id_usuario_terapeuta = v_cita_old.id_usuario_terapeuta
          AND b.register_status = 'Activo'
          AND (v_inicio_new < b.fin AND v_fin_new > b.inicio)
    ) THEN
        RETURN QUERY
        SELECT 'error','BLOQUEO_OVERLAP','El rango se solapa con un bloqueo de agenda del terapeuta',
               jsonb_build_object('inicio',v_inicio_new,'fin',v_fin_new);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 8) UPDATE (misma PK)
    ------------------------------------------------------------------
    UPDATE terapia.cita c
    SET
        id_enfoque        = CASE WHEN (p_patch ? 'id_enfoque') AND jsonb_typeof(p_patch->'id_enfoque') <> 'null'
                                 THEN (p_patch->>'id_enfoque')::int ELSE c.id_enfoque END,
        fecha_programada  = v_fecha_new,
        inicio            = v_inicio_new,
        fin               = v_fin_new,
        canal             = CASE WHEN (p_patch ? 'canal') AND jsonb_typeof(p_patch->'canal') <> 'null'
                                 THEN (p_patch->>'canal') ELSE c.canal END,
        enlace_sesion     = CASE WHEN (p_patch ? 'enlace_sesion') AND jsonb_typeof(p_patch->'enlace_sesion') <> 'null'
                                 THEN (p_patch->>'enlace_sesion') ELSE c.enlace_sesion END,
        direccion         = CASE WHEN (p_patch ? 'direccion') AND jsonb_typeof(p_patch->'direccion') <> 'null'
                                 THEN (p_patch->>'direccion') ELSE c.direccion END,
        notas_internas    = CASE WHEN (p_patch ? 'notas_internas') AND jsonb_typeof(p_patch->'notas_internas') <> 'null'
                                 THEN (p_patch->>'notas_internas') ELSE c.notas_internas END,
        motivo_modificacion = COALESCE(NULLIF(btrim(p_motivo),''), 'Edición de cita')
    WHERE c.id_cita = p_id_cita
    RETURNING * INTO v_cita_new;

    ------------------------------------------------------------------
    -- 9) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'UPDATE_CITA_DETALLE',
        'cita',
        v_cita_new.id_cita,
        jsonb_build_object(
            'old', to_jsonb(v_cita_old),
            'new', to_jsonb(v_cita_new),
            'kept', v_kept,
            'changed', v_changed,
            'deadline', v_deadline,
            'motivo', p_motivo
        )
    );

    RETURN QUERY
    SELECT 'ok', NULL::text, 'Cita modificada correctamente',
           jsonb_build_object('id_cita',v_cita_new.id_cita,'cita',to_jsonb(v_cita_new));
END;
$$;

CREATE OR REPLACE FUNCTION usuarios.fn_listar_terapeutas_sin_admin(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_limit         integer DEFAULT 200
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_sesion seguridad.sesion%ROWTYPE;
    v_admin  usuarios.usuario_admin%ROWTYPE;

    v_total  integer := 0;
    v_items  jsonb   := '[]'::jsonb;
BEGIN
    ------------------------------------------------------------------
    -- 1) Validar sesión activa del actor
    ------------------------------------------------------------------
    SELECT s.*
    INTO v_sesion
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL
    ORDER BY s.timestamp_login DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            'error'::text,
            'INVALID_SESSION'::text,
            'Sesión inválida o expirada'::text,
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Validar que sea admin + super admin
    ------------------------------------------------------------------
    SELECT a.*
    INTO v_admin
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo'
    LIMIT 1;

    IF NOT FOUND THEN
        INSERT INTO seguridad.action_log(
            id_sesion, user_id, tipo_accion, tipo_contenedor, id_contenedor, detalles
        ) VALUES (
            p_id_sesion, p_actor_user_id,
            'LISTAR_TERAPEUTAS_SIN_ADMIN_DENEGADO',
            'usuario_terapeuta',
            NULL,
            jsonb_build_object('reason', 'NOT_ADMIN')
        );

        RETURN QUERY
        SELECT
            'error'::text,
            'NOT_ADMIN'::text,
            'Acción permitida solo para administradores'::text,
            NULL::jsonb;
        RETURN;
    END IF;

    IF NOT COALESCE(v_admin.is_super_admin, false) THEN
        INSERT INTO seguridad.action_log(
            id_sesion, user_id, tipo_accion, tipo_contenedor, id_contenedor, detalles
        ) VALUES (
            p_id_sesion, p_actor_user_id,
            'LISTAR_TERAPEUTAS_SIN_ADMIN_DENEGADO',
            'usuario_terapeuta',
            NULL,
            jsonb_build_object('reason', 'NOT_SUPER_ADMIN')
        );

        RETURN QUERY
        SELECT
            'error'::text,
            'NOT_SUPER_ADMIN'::text,
            'Acción permitida solo para super admins'::text,
            NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Contar total (sin límite)
    ------------------------------------------------------------------
    SELECT COUNT(*)
    INTO v_total
    FROM usuarios.usuario_terapeuta ut
    JOIN usuarios.usuario u ON u.user_id = ut.user_id
    WHERE ut.register_status = 'Activo'
      AND u.register_status = 'Activo'
      AND NOT EXISTS (
          SELECT 1
          FROM usuarios.usuario_admin a
          WHERE a.id_usuario_terapeuta = ut.user_id
            AND a.register_status = 'Activo'
      );

    ------------------------------------------------------------------
    -- 4) Traer items (con límite)
    ------------------------------------------------------------------
    WITH terapeutas AS (
        SELECT
            ut.user_id AS id_usuario_terapeuta,
            u.nombre,
            u.apellido
        FROM usuarios.usuario_terapeuta ut
        JOIN usuarios.usuario u ON u.user_id = ut.user_id
        WHERE ut.register_status = 'Activo'
          AND u.register_status = 'Activo'
          AND NOT EXISTS (
              SELECT 1
              FROM usuarios.usuario_admin a
              WHERE a.id_usuario_terapeuta = ut.user_id
                AND a.register_status = 'Activo'
          )
        ORDER BY u.apellido, u.nombre, ut.user_id
        LIMIT CASE
            WHEN p_limit IS NULL OR p_limit <= 0 THEN 2147483647
            ELSE p_limit
        END
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id_usuario_terapeuta', id_usuario_terapeuta,
                'nombre', concat_ws(' ', nombre, apellido)
            )
        ),
        '[]'::jsonb
    )
    INTO v_items
    FROM terapeutas;

    ------------------------------------------------------------------
    -- 5) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion, user_id, tipo_accion, tipo_contenedor, id_contenedor, detalles
    ) VALUES (
        p_id_sesion, p_actor_user_id,
        'LISTAR_TERAPEUTAS_SIN_ADMIN',
        'usuario_terapeuta',
        NULL,
        jsonb_build_object(
            'limit',    p_limit,
            'total',    v_total,
            'returned', COALESCE(jsonb_array_length(v_items), 0)
        )
    );

    ------------------------------------------------------------------
    -- 6) Respuesta OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok'::text,
        NULL::text,
        'Terapeutas sin admin asignado'::text,
        jsonb_build_object(
            'total', v_total,
            'items', v_items
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        BEGIN
            IF p_id_sesion IS NOT NULL
               AND EXISTS (SELECT 1 FROM seguridad.sesion s WHERE s.id_sesion = p_id_sesion)
            THEN
                INSERT INTO seguridad.action_log(
                    id_sesion, user_id, tipo_accion, tipo_contenedor, id_contenedor, detalles
                ) VALUES (
                    p_id_sesion, p_actor_user_id,
                    'LISTAR_TERAPEUTAS_SIN_ADMIN_ERROR',
                    'usuario_terapeuta',
                    NULL,
                    jsonb_build_object(
                        'error_message', SQLERRM,
                        'error_code',    SQLSTATE
                    )
                );
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        RETURN QUERY
        SELECT
            'error'::text,
            'INTERNAL_ERROR'::text,
            'Error interno al listar terapeutas sin admin'::text,
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_code',    SQLSTATE
            );
        RETURN;
END;
$$;



/* ============================================================
   1) LISTAR ENFOQUES  (con action_log)
   ============================================================ */
CREATE OR REPLACE FUNCTION terapia.fn_listar_enfoques(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_limit         integer DEFAULT 200,
    p_offset        integer DEFAULT 0,
    p_only_activos  boolean DEFAULT true
)
RETURNS TABLE(
    id_enfoque   integer,
    nombre      text,
    descripcion text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_limit        integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_offset       integer := GREATEST(COALESCE(p_offset, 0), 0);
    v_total        integer := 0;
    v_returned     integer := 0;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RAISE EXCEPTION 'MISSING_SESSION';
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SESSION';
    END IF;

    ------------------------------------------------------------------
    -- 1) Totales (para log)
    ------------------------------------------------------------------
    SELECT COUNT(*)
    INTO v_total
    FROM terapia.enfoque e
    WHERE (NOT p_only_activos) OR e.register_status = 'Activo';

    SELECT COUNT(*)
    INTO v_returned
    FROM (
        SELECT 1
        FROM terapia.enfoque e
        WHERE (NOT p_only_activos) OR e.register_status = 'Activo'
        ORDER BY e.nombre, e.id_enfoque
        LIMIT v_limit OFFSET v_offset
    ) x;

    ------------------------------------------------------------------
    -- 2) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'LISTAR_ENFOQUES',
        'enfoque',
        NULL,
        jsonb_build_object(
            'only_activos', p_only_activos,
            'limit', v_limit,
            'offset', v_offset,
            'total', v_total,
            'returned', v_returned
        )
    );

    ------------------------------------------------------------------
    -- 3) Retornar filas
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT e.id_enfoque, e.nombre, e.descripcion
    FROM terapia.enfoque e
    WHERE (NOT p_only_activos) OR e.register_status = 'Activo'
    ORDER BY e.nombre, e.id_enfoque
    LIMIT v_limit
    OFFSET v_offset;

END;
$$;



CREATE OR REPLACE FUNCTION terapia.fn_listar_productos(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_limit         integer DEFAULT 200,
    p_offset        integer DEFAULT 0,
    p_only_activos  boolean DEFAULT true
)
RETURNS TABLE(
    id_producto            integer,
    nombre                 text,
    duracion_minutos       integer,
    precio_base            numeric(12,2),
    categoria              text,
    id_enfoque_default     integer,
    enfoque_default_nombre text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_limit        integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_offset       integer := GREATEST(COALESCE(p_offset, 0), 0);
    v_total        integer := 0;
    v_returned     integer := 0;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RAISE EXCEPTION 'MISSING_SESSION';
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SESSION';
    END IF;

    ------------------------------------------------------------------
    -- 1) Totales (para log)
    ------------------------------------------------------------------
    SELECT COUNT(*)
    INTO v_total
    FROM terapia.producto p
    WHERE (NOT p_only_activos) OR p.register_status = 'Activo';

    SELECT COUNT(*)
    INTO v_returned
    FROM (
        SELECT 1
        FROM terapia.producto p
        WHERE (NOT p_only_activos) OR p.register_status = 'Activo'
        ORDER BY p.nombre, p.id_producto
        LIMIT v_limit OFFSET v_offset
    ) x;

    ------------------------------------------------------------------
    -- 2) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'LISTAR_PRODUCTOS',
        'producto',
        NULL,
        jsonb_build_object(
            'only_activos', p_only_activos,
            'limit', v_limit,
            'offset', v_offset,
            'total', v_total,
            'returned', v_returned
        )
    );

    ------------------------------------------------------------------
    -- 3) Retornar filas
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        p.id_producto,
        p.nombre,
        p.duracion_minutos,
        p.precio_base,
        p.categoria,
        p.id_enfoque_default,
        e.nombre AS enfoque_default_nombre
    FROM terapia.producto p
    LEFT JOIN terapia.enfoque e
           ON e.id_enfoque = p.id_enfoque_default
    WHERE (NOT p_only_activos) OR p.register_status = 'Activo'
    ORDER BY p.nombre, p.id_producto
    LIMIT v_limit
    OFFSET v_offset;

END;
$$;

/* ============================================================
   1) REGISTRAR GRUPO CUENTA (solo admin contador) + action_log
   ============================================================ */
CREATE OR REPLACE FUNCTION contabilidad.fn_registrar_grupo_cuenta(
    p_actor_user_id  integer,
    p_id_sesion      integer,
    p_nombre         text,
    p_codigo         text DEFAULT NULL,
    p_id_grupo_padre integer DEFAULT NULL,
    p_tipo_grupo     text DEFAULT NULL,
    p_metadata       jsonb DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_accounter boolean;
    v_row contabilidad.grupo_cuenta%ROWTYPE;
BEGIN
    -- 0) validar sesión
    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    -- 1) validar contador
    SELECT COALESCE(a.is_accounter,false)
    INTO v_is_accounter
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo';

    IF COALESCE(v_is_accounter,false) IS NOT TRUE THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_GRUPO_CUENTA_DENEGADO','grupo_cuenta',NULL,
            jsonb_build_object('reason','NOT_ACCOUTNER','nombre',p_nombre,'codigo',p_codigo)
        );

        RETURN QUERY SELECT 'error','NOT_ACCOUTNER','El admin no está habilitado como contador',NULL::jsonb;
        RETURN;
    END IF;

    -- 2) validar grupo padre si viene
    IF p_id_grupo_padre IS NOT NULL THEN
        PERFORM 1
        FROM contabilidad.grupo_cuenta g
        WHERE g.id_grupo_cuenta = p_id_grupo_padre
          AND g.register_status = 'Activo';

        IF NOT FOUND THEN
            INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
            VALUES (
                p_id_sesion, p_actor_user_id,
                'CREAR_GRUPO_CUENTA_ERROR','grupo_cuenta',NULL,
                jsonb_build_object('reason','GRUPO_PADRE_NOT_FOUND','id_grupo_padre',p_id_grupo_padre)
            );

            RETURN QUERY SELECT 'error','GRUPO_PADRE_NOT_FOUND','El grupo padre no existe o no está activo',
                jsonb_build_object('id_grupo_padre',p_id_grupo_padre);
            RETURN;
        END IF;
    END IF;

    -- 3) insertar
    INSERT INTO contabilidad.grupo_cuenta(nombre,codigo,id_grupo_padre,tipo_grupo,metadata)
    VALUES (p_nombre,p_codigo,p_id_grupo_padre,p_tipo_grupo,p_metadata)
    RETURNING * INTO v_row;

    -- 4) log
    INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
    VALUES (
        p_id_sesion, p_actor_user_id,
        'CREAR_GRUPO_CUENTA','grupo_cuenta',v_row.id_grupo_cuenta,
        jsonb_build_object('new', to_jsonb(v_row))
    );

    RETURN QUERY
    SELECT 'ok', NULL::text, 'Grupo de cuenta registrado correctamente',
           jsonb_build_object('grupo_cuenta', to_jsonb(v_row), 'id_grupo_cuenta', v_row.id_grupo_cuenta);
    RETURN;

EXCEPTION
    WHEN unique_violation THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_GRUPO_CUENTA_ERROR','grupo_cuenta',NULL,
            jsonb_build_object('reason','DUPLICATE_CODIGO','codigo',p_codigo,'nombre',p_nombre)
        );

        RETURN QUERY SELECT 'error','GRUPO_CUENTA_CODIGO_DUPLICADO','Ya existe un grupo con ese código',
            jsonb_build_object('codigo',p_codigo);
        RETURN;

    WHEN OTHERS THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_GRUPO_CUENTA_ERROR','grupo_cuenta',NULL,
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE)
        );

        RETURN QUERY SELECT 'error','INTERNAL_ERROR','Error interno al registrar grupo cuenta',
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE);
        RETURN;
END;
$$;



/* ============================================================
   2) REGISTRAR CUENTA (solo admin contador) + action_log
   ============================================================ */
CREATE OR REPLACE FUNCTION contabilidad.fn_registrar_cuenta(
    p_actor_user_id   integer,
    p_id_sesion       integer,
    p_nombre          text,
    p_id_grupo_cuenta integer,
    p_codigo          text DEFAULT NULL,
    p_tipo_cuenta     text DEFAULT NULL,
    p_sub_tipo        text DEFAULT NULL,
    p_categoria       text DEFAULT NULL,
    p_moneda          text DEFAULT NULL,
    p_metadata        jsonb DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_accounter boolean;
    v_row contabilidad.cuenta%ROWTYPE;
BEGIN
    -- 0) validar sesión
    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    -- 1) validar contador
    SELECT COALESCE(a.is_accounter,false)
    INTO v_is_accounter
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo';

    IF COALESCE(v_is_accounter,false) IS NOT TRUE THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_CUENTA_DENEGADO','cuenta',NULL,
            jsonb_build_object('reason','NOT_ACCOUTNER','nombre',p_nombre,'codigo',p_codigo)
        );

        RETURN QUERY SELECT 'error','NOT_ACCOUTNER','El admin no está habilitado como contador',NULL::jsonb;
        RETURN;
    END IF;

    -- 2) validar grupo cuenta
    PERFORM 1
    FROM contabilidad.grupo_cuenta g
    WHERE g.id_grupo_cuenta = p_id_grupo_cuenta
      AND g.register_status = 'Activo';

    IF NOT FOUND THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_CUENTA_ERROR','cuenta',NULL,
            jsonb_build_object('reason','GRUPO_CUENTA_NOT_FOUND','id_grupo_cuenta',p_id_grupo_cuenta)
        );

        RETURN QUERY SELECT 'error','GRUPO_CUENTA_NOT_FOUND','El grupo cuenta no existe o no está activo',
            jsonb_build_object('id_grupo_cuenta',p_id_grupo_cuenta);
        RETURN;
    END IF;

    -- 3) insertar
    INSERT INTO contabilidad.cuenta(
        nombre,codigo,id_grupo_cuenta,tipo_cuenta,sub_tipo,categoria,moneda,metadata
    )
    VALUES (
        p_nombre,p_codigo,p_id_grupo_cuenta,p_tipo_cuenta,p_sub_tipo,p_categoria,p_moneda,p_metadata
    )
    RETURNING * INTO v_row;

    -- 4) log
    INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
    VALUES (
        p_id_sesion, p_actor_user_id,
        'CREAR_CUENTA','cuenta',v_row.id_cuenta,
        jsonb_build_object('new', to_jsonb(v_row))
    );

    RETURN QUERY
    SELECT 'ok', NULL::text, 'Cuenta registrada correctamente',
           jsonb_build_object('cuenta', to_jsonb(v_row), 'id_cuenta', v_row.id_cuenta);
    RETURN;

EXCEPTION
    WHEN unique_violation THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_CUENTA_ERROR','cuenta',NULL,
            jsonb_build_object('reason','DUPLICATE_CODIGO','codigo',p_codigo,'nombre',p_nombre)
        );

        RETURN QUERY SELECT 'error','CUENTA_CODIGO_DUPLICADO','Ya existe una cuenta con ese código',
            jsonb_build_object('codigo',p_codigo);
        RETURN;

    WHEN OTHERS THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_CUENTA_ERROR','cuenta',NULL,
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE)
        );

        RETURN QUERY SELECT 'error','INTERNAL_ERROR','Error interno al registrar cuenta',
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE);
        RETURN;
END;
$$;



/* ============================================================
   3) REGISTRAR TRANSACCIÓN + MOVIMIENTOS (asiento) (solo contador)
      p_movimientos = JSONB array:
      [
        {"id_cuenta": 1, "debe": 100, "haber": 0, "descripcion":"..."},
        {"id_cuenta": 2, "debe": 0,   "haber": 100, "descripcion":"..."}
      ]
   ============================================================ */
CREATE OR REPLACE FUNCTION contabilidad.fn_registrar_transaccion(
    p_actor_user_id     integer,
    p_id_sesion         integer,
    p_fecha             date DEFAULT CURRENT_DATE,
    p_tipo_transaccion  text DEFAULT NULL,
    p_glosa             text DEFAULT NULL,
    p_referencia_externa text DEFAULT NULL,
    p_metadata          jsonb DEFAULT NULL,
    p_movimientos       jsonb DEFAULT NULL
)
RETURNS TABLE(
    status        text,
    type_error    text,
    message       text,
    data          jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_accounter boolean;

    v_trans contabilidad.transaccion%ROWTYPE;
    v_total_debe  numeric(14,2) := 0;
    v_total_haber numeric(14,2) := 0;

    v_len int := 0;
    v_elem jsonb;

    v_id_cuenta integer;
    v_debe numeric(14,2);
    v_haber numeric(14,2);
    v_desc text;

    v_mov_ids jsonb := '[]'::jsonb;
BEGIN
    -- 0) validar sesión
    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    -- 1) validar contador
    SELECT COALESCE(a.is_accounter,false)
    INTO v_is_accounter
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo';

    IF COALESCE(v_is_accounter,false) IS NOT TRUE THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_TRANSACCION_DENEGADO','transaccion',NULL,
            jsonb_build_object('reason','NOT_ACCOUTNER')
        );

        RETURN QUERY SELECT 'error','NOT_ACCOUTNER','El admin no está habilitado como contador',NULL::jsonb;
        RETURN;
    END IF;

    -- 2) validar movimientos
    IF p_movimientos IS NULL OR jsonb_typeof(p_movimientos) <> 'array' THEN
        RETURN QUERY SELECT 'error','INVALID_MOVIMIENTOS','p_movimientos debe ser un JSON array',NULL::jsonb;
        RETURN;
    END IF;

    v_len := jsonb_array_length(p_movimientos);

    IF v_len < 2 THEN
        RETURN QUERY SELECT 'error','ASIENTO_INCOMPLETO','Un asiento debe tener al menos 2 movimientos (Debe/Haber)',NULL::jsonb;
        RETURN;
    END IF;

    -- 3) calcular totales + validar líneas
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_movimientos)
    LOOP
        v_id_cuenta := NULLIF(v_elem->>'id_cuenta','')::int;
        v_debe  := COALESCE(NULLIF(v_elem->>'debe','')::numeric, 0);
        v_haber := COALESCE(NULLIF(v_elem->>'haber','')::numeric, 0);
        v_desc  := v_elem->>'descripcion';

        IF v_id_cuenta IS NULL THEN
            RETURN QUERY SELECT 'error','MOVIMIENTO_SIN_CUENTA','Cada movimiento requiere id_cuenta',v_elem;
            RETURN;
        END IF;

        -- cuenta existe y activa
        PERFORM 1
        FROM contabilidad.cuenta c
        WHERE c.id_cuenta = v_id_cuenta
          AND c.register_status = 'Activo';

        IF NOT FOUND THEN
            RETURN QUERY SELECT 'error','CUENTA_NOT_FOUND','Cuenta no existe o no está activa',
                jsonb_build_object('id_cuenta',v_id_cuenta);
            RETURN;
        END IF;

        -- debe/haber válido (exclusivo)
        IF NOT (
            (v_debe > 0 AND v_haber = 0)
            OR (v_haber > 0 AND v_debe = 0)
        ) THEN
            RETURN QUERY SELECT 'error','DEBE_HABER_INVALIDO','Cada movimiento debe tener SOLO debe>0 o haber>0',
                jsonb_build_object('id_cuenta',v_id_cuenta,'debe',v_debe,'haber',v_haber);
            RETURN;
        END IF;

        v_total_debe  := v_total_debe  + v_debe;
        v_total_haber := v_total_haber + v_haber;
    END LOOP;

    IF v_total_debe <= 0 OR v_total_haber <= 0 THEN
        RETURN QUERY SELECT 'error','ASIENTO_SIN_MONTO','El asiento debe tener montos > 0',NULL::jsonb;
        RETURN;
    END IF;

    IF v_total_debe <> v_total_haber THEN
        RETURN QUERY
        SELECT 'error','ASIENTO_DESCUADRADO','El asiento no cuadra (Debe != Haber)',
            jsonb_build_object('total_debe',v_total_debe,'total_haber',v_total_haber);
        RETURN;
    END IF;

    -- 4) insertar transacción
    INSERT INTO contabilidad.transaccion(
        fecha,tipo_transaccion,glosa,referencia_externa,id_usuario_creador,metadata
    )
    VALUES (
        COALESCE(p_fecha, CURRENT_DATE),
        p_tipo_transaccion,
        p_glosa,
        p_referencia_externa,
        p_actor_user_id,
        p_metadata
    )
    RETURNING * INTO v_trans;

    -- 5) insertar movimientos
    v_mov_ids := '[]'::jsonb;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_movimientos)
    LOOP
        v_id_cuenta := NULLIF(v_elem->>'id_cuenta','')::int;
        v_debe  := COALESCE(NULLIF(v_elem->>'debe','')::numeric, 0);
        v_haber := COALESCE(NULLIF(v_elem->>'haber','')::numeric, 0);
        v_desc  := v_elem->>'descripcion';

        INSERT INTO contabilidad.movimiento_cuenta(
            id_transaccion,id_cuenta,debe,haber,descripcion
        )
        VALUES (
            v_trans.id_transaccion, v_id_cuenta, v_debe, v_haber, v_desc
        )
        RETURNING id_movimiento
        INTO v_id_cuenta; -- reutilizo variable como holder

        v_mov_ids := v_mov_ids || jsonb_build_array(v_id_cuenta);
    END LOOP;

    -- 6) log
    INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
    VALUES (
        p_id_sesion, p_actor_user_id,
        'CREAR_TRANSACCION','transaccion',v_trans.id_transaccion,
        jsonb_build_object(
            'id_transaccion', v_trans.id_transaccion,
            'total_debe', v_total_debe,
            'total_haber', v_total_haber,
            'movimientos_count', v_len,
            'movimientos_ids', v_mov_ids
        )
    );

    RETURN QUERY
    SELECT
        'ok', NULL::text, 'Transacción registrada correctamente',
        jsonb_build_object(
            'id_transaccion', v_trans.id_transaccion,
            'transaccion', to_jsonb(v_trans),
            'movimientos_ids', v_mov_ids,
            'total_debe', v_total_debe,
            'total_haber', v_total_haber
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'CREAR_TRANSACCION_ERROR','transaccion',NULL,
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE)
        );

        RETURN QUERY
        SELECT 'error','INTERNAL_ERROR','Error interno al registrar transacción',
               jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE);
        RETURN;
END;
$$;



/* ============================================================
   1) LISTAR GRUPOS DE CUENTA (con action_log)
   ============================================================ */
CREATE OR REPLACE FUNCTION contabilidad.fn_listar_grupos_cuenta(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_limit         integer DEFAULT 200,
    p_offset        integer DEFAULT 0,
    p_only_activos  boolean DEFAULT true
)
RETURNS TABLE(
    id_grupo_cuenta      integer,
    nombre               text,
    codigo               text,
    tipo_grupo           text,
    id_grupo_padre       integer,
    grupo_padre_nombre   text,
    register_status      text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_limit    integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_offset   integer := GREATEST(COALESCE(p_offset, 0), 0);
    v_total    integer := 0;
    v_returned integer := 0;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RAISE EXCEPTION 'MISSING_SESSION';
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SESSION';
    END IF;

    ------------------------------------------------------------------
    -- 1) Totales (para log)
    ------------------------------------------------------------------
    SELECT COUNT(*)
    INTO v_total
    FROM contabilidad.grupo_cuenta gc
    WHERE (NOT p_only_activos) OR gc.register_status = 'Activo';

    SELECT COUNT(*)
    INTO v_returned
    FROM (
        SELECT 1
        FROM contabilidad.grupo_cuenta gc
        WHERE (NOT p_only_activos) OR gc.register_status = 'Activo'
        ORDER BY gc.codigo NULLS LAST, gc.nombre, gc.id_grupo_cuenta
        LIMIT v_limit OFFSET v_offset
    ) x;

    ------------------------------------------------------------------
    -- 2) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'LISTAR_GRUPOS_CUENTA',
        'grupo_cuenta',
        NULL,
        jsonb_build_object(
            'only_activos', p_only_activos,
            'limit', v_limit,
            'offset', v_offset,
            'total', v_total,
            'returned', v_returned
        )
    );

    ------------------------------------------------------------------
    -- 3) Retornar filas
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        gc.id_grupo_cuenta,
        gc.nombre,
        gc.codigo,
        gc.tipo_grupo,
        gc.id_grupo_padre,
        gp.nombre AS grupo_padre_nombre,
        gc.register_status
    FROM contabilidad.grupo_cuenta gc
    LEFT JOIN contabilidad.grupo_cuenta gp
           ON gp.id_grupo_cuenta = gc.id_grupo_padre
    WHERE (NOT p_only_activos) OR gc.register_status = 'Activo'
    ORDER BY gc.codigo NULLS LAST, gc.nombre, gc.id_grupo_cuenta
    LIMIT v_limit
    OFFSET v_offset;

END;
$$;



/* ============================================================
   2) LISTAR CUENTAS (con action_log)
   ============================================================ */
CREATE OR REPLACE FUNCTION contabilidad.fn_listar_cuentas(
    p_actor_user_id  integer,
    p_id_sesion      integer,
    p_limit          integer DEFAULT 200,
    p_offset         integer DEFAULT 0,
    p_only_activos   boolean DEFAULT true,
    p_id_grupo_cuenta integer DEFAULT NULL
)
RETURNS TABLE(
    id_cuenta           integer,
    nombre              text,
    codigo              text,
    id_grupo_cuenta     integer,
    grupo_cuenta_nombre text,
    tipo_cuenta         text,
    sub_tipo            text,
    categoria           text,
    moneda              text,
    register_status     text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    v_limit    integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_offset   integer := GREATEST(COALESCE(p_offset, 0), 0);
    v_total    integer := 0;
    v_returned integer := 0;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RAISE EXCEPTION 'MISSING_SESSION';
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SESSION';
    END IF;

    ------------------------------------------------------------------
    -- 1) Totales (para log)
    ------------------------------------------------------------------
    SELECT COUNT(*)
    INTO v_total
    FROM contabilidad.cuenta c
    WHERE ((NOT p_only_activos) OR c.register_status = 'Activo')
      AND (p_id_grupo_cuenta IS NULL OR c.id_grupo_cuenta = p_id_grupo_cuenta);

    SELECT COUNT(*)
    INTO v_returned
    FROM (
        SELECT 1
        FROM contabilidad.cuenta c
        WHERE ((NOT p_only_activos) OR c.register_status = 'Activo')
          AND (p_id_grupo_cuenta IS NULL OR c.id_grupo_cuenta = p_id_grupo_cuenta)
        ORDER BY c.codigo NULLS LAST, c.nombre, c.id_cuenta
        LIMIT v_limit OFFSET v_offset
    ) x;

    ------------------------------------------------------------------
    -- 2) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,
        user_id,
        tipo_accion,
        tipo_contenedor,
        id_contenedor,
        detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'LISTAR_CUENTAS',
        'cuenta',
        NULL,
        jsonb_build_object(
            'only_activos', p_only_activos,
            'id_grupo_cuenta', p_id_grupo_cuenta,
            'limit', v_limit,
            'offset', v_offset,
            'total', v_total,
            'returned', v_returned
        )
    );

    ------------------------------------------------------------------
    -- 3) Retornar filas
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        c.id_cuenta,
        c.nombre,
        c.codigo,
        c.id_grupo_cuenta,
        gc.nombre AS grupo_cuenta_nombre,
        c.tipo_cuenta,
        c.sub_tipo,
        c.categoria,
        c.moneda,
        c.register_status
    FROM contabilidad.cuenta c
    JOIN contabilidad.grupo_cuenta gc
      ON gc.id_grupo_cuenta = c.id_grupo_cuenta
    WHERE ((NOT p_only_activos) OR c.register_status = 'Activo')
      AND (p_id_grupo_cuenta IS NULL OR c.id_grupo_cuenta = p_id_grupo_cuenta)
    ORDER BY c.codigo NULLS LAST, c.nombre, c.id_cuenta
    LIMIT v_limit
    OFFSET v_offset;

END;
$$;




/* ============================================================
   REGISTRAR VISITA PÚBLICA
   - Inserta en seguridad.visita_publica
   - No requiere sesión ni user_id (es tráfico anónimo)
   ============================================================ */
CREATE OR REPLACE FUNCTION seguridad.fn_registrar_visita_publica(
    p_ip_acceso         inet,
    p_user_agent        text,
    p_metodo_http       text,
    p_path              text,
    p_query_string      text DEFAULT NULL,
    p_referrer          text DEFAULT NULL,
    p_session_public_id text DEFAULT NULL,
    p_pais              text DEFAULT NULL,
    p_device_type       text DEFAULT NULL,
    p_metadata          jsonb DEFAULT NULL
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_row seguridad.visita_publica%ROWTYPE;
BEGIN
    ------------------------------------------------------------------
    -- 1) Validaciones mínimas
    ------------------------------------------------------------------
    IF p_metodo_http IS NULL OR btrim(p_metodo_http) = '' THEN
        RETURN QUERY
        SELECT 'error','MISSING_METODO_HTTP','metodo_http es requerido',NULL::jsonb;
        RETURN;
    END IF;

    IF p_path IS NULL OR btrim(p_path) = '' THEN
        RETURN QUERY
        SELECT 'error','MISSING_PATH','path es requerido',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Insert
    ------------------------------------------------------------------
    INSERT INTO seguridad.visita_publica(
        ip_acceso,
        user_agent,
        metodo_http,
        path,
        query_string,
        referrer,
        session_public_id,
        pais,
        device_type,
        metadata
    )
    VALUES (
        p_ip_acceso,
        p_user_agent,
        upper(p_metodo_http),
        p_path,
        p_query_string,
        p_referrer,
        p_session_public_id,
        p_pais,
        p_device_type,
        p_metadata
    )
    RETURNING *
    INTO v_row;

    ------------------------------------------------------------------
    -- 3) OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok',
        NULL::text,
        'Visita registrada correctamente',
        jsonb_build_object(
            'id_visita', v_row.id_visita,
            'timestamp_visita', v_row.timestamp_visita,
            'visita', to_jsonb(v_row)
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error',
            'INTERNAL_ERROR',
            'Error interno al registrar visita',
            jsonb_build_object('error_message', SQLERRM, 'error_code', SQLSTATE);
        RETURN;
END;
$$;


CREATE OR REPLACE FUNCTION analytics.fn_registrar_ui_events_bulk(
    p_session_public_id text,
    p_user_id           integer DEFAULT NULL,
    p_events            jsonb default null
)
RETURNS TABLE(
    status     text,
    type_error text,
    message    text,
    data       jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_count_input   integer := 0;
    v_count_insert  integer := 0;
    v_ids           jsonb := '[]'::jsonb;
BEGIN
    ------------------------------------------------------------------
    -- 1) Validaciones básicas
    ------------------------------------------------------------------
    IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
        RETURN QUERY
        SELECT 'error','INVALID_EVENTS','p_events debe ser un JSONB array',NULL::jsonb;
        RETURN;
    END IF;

    v_count_input := jsonb_array_length(p_events);

    IF v_count_input = 0 THEN
        RETURN QUERY
        SELECT 'error','EMPTY_EVENTS','p_events no puede estar vacío',NULL::jsonb;
        RETURN;
    END IF;

    IF p_session_public_id IS NULL OR btrim(p_session_public_id) = '' THEN
        -- puedes permitir NULL si mandas session_public_id por-evento,
        -- pero si NO lo mandas, no habría cómo agrupar.
        -- Aquí lo requerimos como default.
        RETURN QUERY
        SELECT 'error','MISSING_SESSION_PUBLIC_ID','p_session_public_id es requerido',NULL::jsonb;
        RETURN;
    END IF;

    IF v_count_input > 1000 THEN
        RETURN QUERY
        SELECT 'error','TOO_MANY_EVENTS','Máximo 1000 eventos por llamada',
               jsonb_build_object('count', v_count_input);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) Validar campos requeridos por-evento
    ------------------------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM jsonb_to_recordset(p_events) AS e(
            event_type text,
            element_key text
        )
        WHERE e.event_type IS NULL OR btrim(e.event_type) = ''
           OR e.element_key IS NULL OR btrim(e.element_key) = ''
    ) THEN
        RETURN QUERY
        SELECT 'error','MISSING_REQUIRED_FIELDS',
               'Cada evento requiere event_type y element_key',
               NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Insert masivo + retorno de IDs
    ------------------------------------------------------------------
    WITH src AS (
        SELECT
            COALESCE(e.session_public_id, p_session_public_id) AS session_public_id,
            COALESCE(e.user_id, p_user_id)                      AS user_id,
            COALESCE(e.timestamp_event, now())                  AS timestamp_event,
            e.event_type,
            e.element_key,
            e.element_value,
            e.page_path,
            e.metadata
        FROM jsonb_to_recordset(p_events) AS e(
            session_public_id text,
            user_id           integer,
            timestamp_event   timestamptz,
            event_type        text,
            element_key       text,
            element_value     text,
            page_path         text,
            metadata          jsonb
        )
    ),
    ins AS (
        INSERT INTO analytics.ui_event(
            session_public_id,
            user_id,
            timestamp_event,
            event_type,
            element_key,
            element_value,
            page_path,
            metadata
        )
        SELECT
            s.session_public_id,
            s.user_id,
            s.timestamp_event,
            s.event_type,
            s.element_key,
            s.element_value,
            s.page_path,
            s.metadata
        FROM src s
        RETURNING id_event
    )
    SELECT
        COUNT(*)::int,
        COALESCE(jsonb_agg(id_event ORDER BY id_event), '[]'::jsonb)
    INTO v_count_insert, v_ids
    FROM ins;

    ------------------------------------------------------------------
    -- 4) OK
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT
        'ok'::text,
        NULL::text,
        'Eventos UI registrados correctamente'::text,
        jsonb_build_object(
            'session_public_id', p_session_public_id,
            'input_count',  v_count_input,
            'inserted_count', v_count_insert,
            'ids', v_ids
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY
        SELECT
            'error',
            'INTERNAL_ERROR',
            'Error interno al registrar eventos UI',
            jsonb_build_object('error_message', SQLERRM, 'error_code', SQLSTATE);
        RETURN;
END;
$$;


/* ============================================================
   2) FUNCIÓN: obtener horarios registrados por id_terapeuta
      - valida sesión
      - deja log en seguridad.action_log
      - retorna filas de la VIEW
   ============================================================ */
CREATE OR REPLACE FUNCTION terapia.fn_obtener_horarios_terapeuta(
    p_actor_user_id      integer,
    p_id_sesion          integer,
    p_id_usuario_terapeuta integer,
    p_only_activos       boolean DEFAULT true,
    p_limit              integer DEFAULT 200,
    p_offset             integer DEFAULT 0
)
RETURNS SETOF terapia.vw_horarios_terapeuta_full
LANGUAGE plpgsql
AS $$
DECLARE
    v_limit    integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_offset   integer := GREATEST(COALESCE(p_offset, 0), 0);
    v_total    integer := 0;
    v_returned integer := 0;
BEGIN
    ------------------------------------------------------------------
    -- 0) Validar sesión
    ------------------------------------------------------------------
    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SESSION';
    END IF;

    ------------------------------------------------------------------
    -- 1) Validar terapeuta existe/activo
    ------------------------------------------------------------------
    PERFORM 1
    FROM usuarios.usuario_terapeuta ut
    JOIN usuarios.usuario u ON u.user_id = ut.user_id
    WHERE ut.user_id = p_id_usuario_terapeuta
      AND ut.register_status = 'Activo'
      AND u.register_status  = 'Activo';

    IF NOT FOUND THEN
        INSERT INTO seguridad.action_log(
            id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles
        ) VALUES (
            p_id_sesion, p_actor_user_id,
            'LISTAR_HORARIOS_TERAPEUTA_ERROR','horario_terapeuta',p_id_usuario_terapeuta,
            jsonb_build_object('reason','TERAPEUTA_NOT_FOUND','id_usuario_terapeuta',p_id_usuario_terapeuta)
        );

        RAISE EXCEPTION 'TERAPEUTA_NOT_FOUND';
    END IF;

    ------------------------------------------------------------------
    -- 2) Total y returned (para log)
    ------------------------------------------------------------------
    SELECT COUNT(*)
    INTO v_total
    FROM terapia.vw_horarios_terapeuta_full v
    WHERE v.id_usuario_terapeuta = p_id_usuario_terapeuta
      AND ((NOT p_only_activos) OR v.horario_register_status = 'Activo');

    SELECT COUNT(*)
    INTO v_returned
    FROM (
        SELECT 1
        FROM terapia.vw_horarios_terapeuta_full v
        WHERE v.id_usuario_terapeuta = p_id_usuario_terapeuta
          AND ((NOT p_only_activos) OR v.horario_register_status = 'Activo')
        ORDER BY v.dia_semana, v.hora_inicio, v.id_horario_terapeuta
        LIMIT v_limit OFFSET v_offset
    ) x;

    ------------------------------------------------------------------
    -- 3) Log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'LISTAR_HORARIOS_TERAPEUTA',
        'horario_terapeuta',
        p_id_usuario_terapeuta,
        jsonb_build_object(
            'id_usuario_terapeuta', p_id_usuario_terapeuta,
            'only_activos', p_only_activos,
            'limit', v_limit,
            'offset', v_offset,
            'total', v_total,
            'returned', v_returned
        )
    );

    ------------------------------------------------------------------
    -- 4) Retornar filas
    ------------------------------------------------------------------
    RETURN QUERY
    SELECT *
    FROM terapia.vw_horarios_terapeuta_full v
    WHERE v.id_usuario_terapeuta = p_id_usuario_terapeuta
      AND ((NOT p_only_activos) OR v.horario_register_status = 'Activo')
    ORDER BY v.dia_semana, v.hora_inicio, v.id_horario_terapeuta
    LIMIT v_limit
    OFFSET v_offset;

END;
$$;


/* ============================================================
   UPDATE PACIENTE FULL (clase hija + padre en 1 sola función)
   - Actualiza: usuarios.usuario  +  usuarios.usuario_paciente
   - 1 sola transacción (atómico): si algo falla, NO queda a medias
   - Permisos: el mismo user o admin activo
   - Log: seguridad.action_log (1 registro con old/new de ambas tablas)
   - p_patch admite campos de ambas tablas (union)
   ============================================================ */
CREATE OR REPLACE FUNCTION usuarios.fn_update_paciente_full(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_user_id       integer,   -- paciente user_id (también es el user_id en usuarios.usuario)
    p_patch         jsonb
)
RETURNS TABLE(status text, type_error text, message text, data jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
    v_allowed_usuario text[] := ARRAY[
        'telefono','password_hash','nombre','apellido','sexo','fecha_nacimiento',
        'foto_perfil_link','foto_portada_link'
    ];

    v_allowed_paciente text[] := ARRAY[
        'pais','ciudad','ocupacion','notas_internas','perfil_psicologico'
    ];

    v_is_admin boolean := false;

    v_u_old usuarios.usuario%ROWTYPE;
    v_u_new usuarios.usuario%ROWTYPE;

    v_p_old usuarios.usuario_paciente%ROWTYPE;
    v_p_new usuarios.usuario_paciente%ROWTYPE;

BEGIN
    ------------------------------------------------------------------
    -- 0) sesión
    ------------------------------------------------------------------
    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) patch válido
    ------------------------------------------------------------------
    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RETURN QUERY SELECT 'error','INVALID_PATCH','p_patch debe ser un JSON object',NULL::jsonb;
        RETURN;
    END IF;

    -- Validar que no vengan keys fuera del conjunto permitido (usuario ∪ paciente)
    IF EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_patch) k
        WHERE k NOT IN (
            SELECT unnest(v_allowed_usuario)
            UNION
            SELECT unnest(v_allowed_paciente)
        )
    ) THEN
        RETURN QUERY
        SELECT
            'error','PATCH_NOT_ALLOWED',
            'p_patch contiene campos no permitidos',
            jsonb_build_object(
                'allowed_usuario',  v_allowed_usuario,
                'allowed_paciente', v_allowed_paciente
            );
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) permisos (self o admin)
    ------------------------------------------------------------------
    SELECT EXISTS(
        SELECT 1
        FROM usuarios.usuario_admin a
        WHERE a.user_id = p_actor_user_id
          AND a.register_status = 'Activo'
    )
    INTO v_is_admin;

    IF (p_actor_user_id <> p_user_id) AND (NOT v_is_admin) THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_PACIENTE_FULL_DENEGADO','usuario_paciente',p_user_id,
            jsonb_build_object('reason','NOT_ALLOWED','patch',p_patch)
        );

        RETURN QUERY SELECT 'error','NOT_ALLOWED','No tienes permisos para actualizar este paciente',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Lock y existencia: usuario + paciente
    ------------------------------------------------------------------
    SELECT *
    INTO v_u_old
    FROM usuarios.usuario u
    WHERE u.user_id = p_user_id
      AND u.register_status = 'Activo'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error','USUARIO_NOT_FOUND','Usuario no existe o no está activo',
               jsonb_build_object('user_id',p_user_id);
        RETURN;
    END IF;

    SELECT *
    INTO v_p_old
    FROM usuarios.usuario_paciente p
    WHERE p.user_id = p_user_id
      AND p.register_status = 'Activo'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error','PACIENTE_NOT_FOUND','Paciente no existe o no está activo',
               jsonb_build_object('user_id',p_user_id);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) UPDATE padre: usuarios.usuario (solo si vienen keys)
    ------------------------------------------------------------------
    UPDATE usuarios.usuario u
    SET
        telefono          = CASE WHEN p_patch ? 'telefono'          THEN (p_patch->>'telefono')               ELSE u.telefono END,
        password_hash     = CASE WHEN p_patch ? 'password_hash'     THEN (p_patch->>'password_hash')          ELSE u.password_hash END,
        nombre            = CASE WHEN p_patch ? 'nombre'            THEN (p_patch->>'nombre')                 ELSE u.nombre END,
        apellido          = CASE WHEN p_patch ? 'apellido'          THEN (p_patch->>'apellido')               ELSE u.apellido END,
        sexo              = CASE WHEN p_patch ? 'sexo'              THEN (p_patch->>'sexo')                   ELSE u.sexo END,
        fecha_nacimiento  = CASE WHEN p_patch ? 'fecha_nacimiento'  THEN (p_patch->>'fecha_nacimiento')::date ELSE u.fecha_nacimiento END,
        foto_perfil_link  = CASE WHEN p_patch ? 'foto_perfil_link'  THEN (p_patch->>'foto_perfil_link')       ELSE u.foto_perfil_link END,
        foto_portada_link = CASE WHEN p_patch ? 'foto_portada_link' THEN (p_patch->>'foto_portada_link')      ELSE u.foto_portada_link END,
        updated_at        = CURRENT_TIMESTAMP
    WHERE u.user_id = p_user_id
    RETURNING * INTO v_u_new;

    ------------------------------------------------------------------
    -- 5) UPDATE hija: usuarios.usuario_paciente (solo si vienen keys)
    ------------------------------------------------------------------
    UPDATE usuarios.usuario_paciente p
    SET
        pais               = CASE WHEN p_patch ? 'pais'               THEN (p_patch->>'pais')            ELSE p.pais END,
        ciudad             = CASE WHEN p_patch ? 'ciudad'             THEN (p_patch->>'ciudad')          ELSE p.ciudad END,
        ocupacion          = CASE WHEN p_patch ? 'ocupacion'          THEN (p_patch->>'ocupacion')       ELSE p.ocupacion END,
        notas_internas     = CASE WHEN p_patch ? 'notas_internas'     THEN (p_patch->>'notas_internas')  ELSE p.notas_internas END,
        perfil_psicologico = CASE WHEN p_patch ? 'perfil_psicologico' THEN (p_patch->'perfil_psicologico') ELSE p.perfil_psicologico END,
        updated_at         = CURRENT_TIMESTAMP
    WHERE p.user_id = p_user_id
    RETURNING * INTO v_p_new;

    ------------------------------------------------------------------
    -- 6) Log único
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
    VALUES (
        p_id_sesion, p_actor_user_id,
        'UPDATE_PACIENTE_FULL','usuario_paciente',p_user_id,
        jsonb_build_object(
            'patch', p_patch,
            'old', jsonb_build_object(
                'usuario', to_jsonb(v_u_old),
                'usuario_paciente', to_jsonb(v_p_old)
            ),
            'new', jsonb_build_object(
                'usuario', to_jsonb(v_u_new),
                'usuario_paciente', to_jsonb(v_p_new)
            )
        )
    );

    RETURN QUERY
    SELECT
        'ok', NULL::text, 'Paciente actualizado correctamente (usuario + paciente)',
        jsonb_build_object(
            'user_id', p_user_id,
            'usuario', to_jsonb(v_u_new),
            'usuario_paciente', to_jsonb(v_p_new)
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_PACIENTE_FULL_ERROR','usuario_paciente',p_user_id,
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE,'patch',p_patch)
        );

        RETURN QUERY
        SELECT 'error','INTERNAL_ERROR','Error interno al actualizar paciente',
               jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE);
        RETURN;
END;
$$;

/* ============================================================
   UPDATE: terapia.enfoque
   Campos permitidos: nombre, descripcion, metadata
   - Permisos: admin
   - Log: seguridad.action_log
   ============================================================ */
CREATE OR REPLACE FUNCTION terapia.fn_update_enfoque(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_id_enfoque    integer,
    p_patch         jsonb
)
RETURNS TABLE(status text, type_error text, message text, data jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
    v_allowed text[] := ARRAY['nombre','descripcion','metadata'];
    v_is_admin boolean := false;

    v_old terapia.enfoque%ROWTYPE;
    v_new terapia.enfoque%ROWTYPE;
BEGIN
    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RETURN QUERY SELECT 'error','INVALID_PATCH','p_patch debe ser un JSON object',NULL::jsonb;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_patch) k
        WHERE k NOT IN (SELECT unnest(v_allowed))
    ) THEN
        RETURN QUERY
        SELECT 'error','PATCH_NOT_ALLOWED','p_patch contiene campos no permitidos',
               jsonb_build_object('allowed', v_allowed);
        RETURN;
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM usuarios.usuario_admin a
        WHERE a.user_id = p_actor_user_id
          AND a.register_status = 'Activo'
    )
    INTO v_is_admin;

    IF NOT v_is_admin THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_ENFOQUE_DENEGADO','enfoque',p_id_enfoque,
            jsonb_build_object('reason','NOT_ADMIN','patch',p_patch)
        );

        RETURN QUERY SELECT 'error','NOT_ADMIN','Acción permitida solo para admins',NULL::jsonb;
        RETURN;
    END IF;

    SELECT *
    INTO v_old
    FROM terapia.enfoque e
    WHERE e.id_enfoque = p_id_enfoque
      AND e.register_status = 'Activo'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','ENFOQUE_NOT_FOUND','Enfoque no existe o no está activo',
            jsonb_build_object('id_enfoque',p_id_enfoque);
        RETURN;
    END IF;

    UPDATE terapia.enfoque e
    SET
        nombre      = CASE WHEN p_patch ? 'nombre'      THEN (p_patch->>'nombre')      ELSE e.nombre END,
        descripcion = CASE WHEN p_patch ? 'descripcion' THEN (p_patch->>'descripcion') ELSE e.descripcion END,
        metadata    = CASE WHEN p_patch ? 'metadata'    THEN (p_patch->'metadata')     ELSE e.metadata END,
        updated_at  = CURRENT_TIMESTAMP
    WHERE e.id_enfoque = p_id_enfoque
    RETURNING * INTO v_new;

    INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
    VALUES (
        p_id_sesion, p_actor_user_id,
        'UPDATE_ENFOQUE','enfoque',p_id_enfoque,
        jsonb_build_object('old',to_jsonb(v_old),'new',to_jsonb(v_new),'patch',p_patch)
    );

    RETURN QUERY
    SELECT 'ok', NULL::text, 'Enfoque actualizado correctamente',
           jsonb_build_object('id_enfoque',p_id_enfoque,'enfoque',to_jsonb(v_new));
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_ENFOQUE_ERROR','enfoque',p_id_enfoque,
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE,'patch',p_patch)
        );

        RETURN QUERY
        SELECT 'error','INTERNAL_ERROR','Error interno al actualizar enfoque',
               jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE);
        RETURN;
END;
$$;



/* ============================================================
   UPDATE: terapia.producto
   Campos permitidos:
   nombre, descripcion, id_enfoque_default, duracion_minutos, precio_base,
   costo_base, categoria, metadata
   - Permisos: admin
   - Log: seguridad.action_log
   ============================================================ */
CREATE OR REPLACE FUNCTION terapia.fn_update_producto(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_id_producto   integer,
    p_patch         jsonb
)
RETURNS TABLE(status text, type_error text, message text, data jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
    v_allowed text[] := ARRAY[
        'nombre','descripcion','id_enfoque_default','duracion_minutos',
        'precio_base','costo_base','categoria','metadata'
    ];

    v_is_admin boolean := false;

    v_old terapia.producto%ROWTYPE;
    v_new terapia.producto%ROWTYPE;

    v_dur int;
    v_prec numeric;
    v_cost numeric;
    v_id_enf int;
BEGIN
    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RETURN QUERY SELECT 'error','INVALID_PATCH','p_patch debe ser un JSON object',NULL::jsonb;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_patch) k
        WHERE k NOT IN (SELECT unnest(v_allowed))
    ) THEN
        RETURN QUERY
        SELECT 'error','PATCH_NOT_ALLOWED','p_patch contiene campos no permitidos',
               jsonb_build_object('allowed', v_allowed);
        RETURN;
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM usuarios.usuario_admin a
        WHERE a.user_id = p_actor_user_id
          AND a.register_status = 'Activo'
    )
    INTO v_is_admin;

    IF NOT v_is_admin THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_PRODUCTO_DENEGADO','producto',p_id_producto,
            jsonb_build_object('reason','NOT_ADMIN','patch',p_patch)
        );

        RETURN QUERY SELECT 'error','NOT_ADMIN','Acción permitida solo para admins',NULL::jsonb;
        RETURN;
    END IF;

    -- validaciones simples si vienen
    IF p_patch ? 'duracion_minutos' THEN
        v_dur := (p_patch->>'duracion_minutos')::int;
        IF v_dur IS NOT NULL AND v_dur <= 0 THEN
            RETURN QUERY SELECT 'error','INVALID_DURACION','duracion_minutos debe ser > 0',
                jsonb_build_object('duracion_minutos',v_dur);
            RETURN;
        END IF;
    END IF;

    IF p_patch ? 'precio_base' THEN
        v_prec := (p_patch->>'precio_base')::numeric;
        IF v_prec IS NOT NULL AND v_prec < 0 THEN
            RETURN QUERY SELECT 'error','INVALID_PRECIO','precio_base no puede ser negativo',
                jsonb_build_object('precio_base',v_prec);
            RETURN;
        END IF;
    END IF;

    IF p_patch ? 'costo_base' THEN
        v_cost := (p_patch->>'costo_base')::numeric;
        IF v_cost IS NOT NULL AND v_cost < 0 THEN
            RETURN QUERY SELECT 'error','INVALID_COSTO','costo_base no puede ser negativo',
                jsonb_build_object('costo_base',v_cost);
            RETURN;
        END IF;
    END IF;

    IF p_patch ? 'id_enfoque_default' THEN
        v_id_enf := (p_patch->>'id_enfoque_default')::int;
        IF v_id_enf IS NOT NULL THEN
            PERFORM 1
            FROM terapia.enfoque e
            WHERE e.id_enfoque = v_id_enf
              AND e.register_status = 'Activo';

            IF NOT FOUND THEN
                RETURN QUERY SELECT 'error','ENFOQUE_DEFAULT_NOT_FOUND','El enfoque default no existe o no está activo',
                    jsonb_build_object('id_enfoque_default',v_id_enf);
                RETURN;
            END IF;
        END IF;
    END IF;

    SELECT *
    INTO v_old
    FROM terapia.producto p
    WHERE p.id_producto = p_id_producto
      AND p.register_status = 'Activo'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','PRODUCTO_NOT_FOUND','Producto no existe o no está activo',
            jsonb_build_object('id_producto',p_id_producto);
        RETURN;
    END IF;

    UPDATE terapia.producto p
    SET
        nombre            = CASE WHEN p_patch ? 'nombre'            THEN (p_patch->>'nombre')            ELSE p.nombre END,
        descripcion       = CASE WHEN p_patch ? 'descripcion'       THEN (p_patch->>'descripcion')       ELSE p.descripcion END,
        id_enfoque_default= CASE WHEN p_patch ? 'id_enfoque_default'THEN (p_patch->>'id_enfoque_default')::int ELSE p.id_enfoque_default END,
        duracion_minutos  = CASE WHEN p_patch ? 'duracion_minutos'  THEN (p_patch->>'duracion_minutos')::int  ELSE p.duracion_minutos END,
        precio_base       = CASE WHEN p_patch ? 'precio_base'       THEN (p_patch->>'precio_base')::numeric   ELSE p.precio_base END,
        costo_base        = CASE WHEN p_patch ? 'costo_base'        THEN (p_patch->>'costo_base')::numeric    ELSE p.costo_base END,
        categoria         = CASE WHEN p_patch ? 'categoria'         THEN (p_patch->>'categoria')         ELSE p.categoria END,
        metadata          = CASE WHEN p_patch ? 'metadata'          THEN (p_patch->'metadata')           ELSE p.metadata END,
        updated_at        = CURRENT_TIMESTAMP
    WHERE p.id_producto = p_id_producto
    RETURNING * INTO v_new;

    INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
    VALUES (
        p_id_sesion, p_actor_user_id,
        'UPDATE_PRODUCTO','producto',p_id_producto,
        jsonb_build_object('old',to_jsonb(v_old),'new',to_jsonb(v_new),'patch',p_patch)
    );

    RETURN QUERY
    SELECT 'ok', NULL::text, 'Producto actualizado correctamente',
           jsonb_build_object('id_producto',p_id_producto,'producto',to_jsonb(v_new));
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_PRODUCTO_ERROR','producto',p_id_producto,
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE,'patch',p_patch)
        );

        RETURN QUERY
        SELECT 'error','INTERNAL_ERROR','Error interno al actualizar producto',
               jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE);
        RETURN;
END;
$$;

/* ============================================================
   UPDATE TERAPEUTA FULL (clase hija + padre en 1 sola función)
   - Actualiza: usuarios.usuario  +  usuarios.usuario_terapeuta
   - Atómico (1 transacción)
   - Permisos: el mismo terapeuta, o admin asignado a ese terapeuta, o super_admin
   - Log: seguridad.action_log (1 registro con old/new de ambas tablas)
   - p_patch admite campos de ambas tablas (union)
   ============================================================ */
CREATE OR REPLACE FUNCTION usuarios.fn_update_terapeuta_full(
    p_actor_user_id integer,
    p_id_sesion     integer,
    p_user_id       integer,  
    p_patch         jsonb
)
RETURNS TABLE(status text, type_error text, message text, data jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
    v_allowed_usuario text[] := ARRAY[
        'telefono','password_hash','nombre','apellido','sexo','fecha_nacimiento',
        'foto_perfil_link','foto_portada_link'
    ];

    v_allowed_terapeuta text[] := ARRAY[
        'titulo_profesional','especialidad_principal','descripcion_perfil','frase_personal',
        'link_video_youtube','matricula_profesional','pais','ciudad','valor_sesion_base'
    ];

    v_is_admin boolean := false;
    v_is_super boolean := false;
    v_admin_terapeuta integer;

    v_u_old usuarios.usuario%ROWTYPE;
    v_u_new usuarios.usuario%ROWTYPE;

    v_t_old usuarios.usuario_terapeuta%ROWTYPE;
    v_t_new usuarios.usuario_terapeuta%ROWTYPE;

    v_valor numeric;
BEGIN
    ------------------------------------------------------------------
    -- 0) sesión
    ------------------------------------------------------------------
    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) patch válido
    ------------------------------------------------------------------
    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RETURN QUERY SELECT 'error','INVALID_PATCH','p_patch debe ser un JSON object',NULL::jsonb;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_patch) k
        WHERE k NOT IN (
            SELECT unnest(v_allowed_usuario)
            UNION
            SELECT unnest(v_allowed_terapeuta)
        )
    ) THEN
        RETURN QUERY
        SELECT
            'error','PATCH_NOT_ALLOWED',
            'p_patch contiene campos no permitidos',
            jsonb_build_object(
                'allowed_usuario',   v_allowed_usuario,
                'allowed_terapeuta', v_allowed_terapeuta
            );
        RETURN;
    END IF;

    IF p_patch ? 'valor_sesion_base' THEN
        v_valor := (p_patch->>'valor_sesion_base')::numeric;
        IF v_valor IS NOT NULL AND v_valor < 0 THEN
            RETURN QUERY SELECT 'error','INVALID_VALOR','valor_sesion_base no puede ser negativo',
                jsonb_build_object('valor_sesion_base', v_valor);
            RETURN;
        END IF;
    END IF;

    ------------------------------------------------------------------
    -- 2) permisos
    ------------------------------------------------------------------
    SELECT
        true,
        COALESCE(a.is_super_admin,false),
        a.id_usuario_terapeuta
    INTO v_is_admin, v_is_super, v_admin_terapeuta
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo'
    LIMIT 1;

    IF NOT FOUND THEN
        v_is_admin := false;
        v_is_super := false;
        v_admin_terapeuta := NULL;
    END IF;

    IF NOT (
        p_actor_user_id = p_user_id
        OR v_is_super
        OR (v_is_admin AND v_admin_terapeuta = p_user_id)
    ) THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_TERAPEUTA_FULL_DENEGADO','usuario_terapeuta',p_user_id,
            jsonb_build_object(
                'reason','NOT_ALLOWED',
                'admin_scope_terapeuta', v_admin_terapeuta,
                'patch', p_patch
            )
        );

        RETURN QUERY SELECT 'error','NOT_ALLOWED','No tienes permisos para actualizar este terapeuta',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) Lock y existencia: usuario + terapeuta
    ------------------------------------------------------------------
    SELECT *
    INTO v_u_old
    FROM usuarios.usuario u
    WHERE u.user_id = p_user_id
      AND u.register_status = 'Activo'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error','USUARIO_NOT_FOUND','Usuario no existe o no está activo',
               jsonb_build_object('user_id',p_user_id);
        RETURN;
    END IF;

    SELECT *
    INTO v_t_old
    FROM usuarios.usuario_terapeuta t
    WHERE t.user_id = p_user_id
      AND t.register_status = 'Activo'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error','TERAPEUTA_NOT_FOUND','Terapeuta no existe o no está activo',
               jsonb_build_object('user_id',p_user_id);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) UPDATE padre: usuarios.usuario
    ------------------------------------------------------------------
    UPDATE usuarios.usuario u
    SET
        telefono          = CASE WHEN p_patch ? 'telefono'          THEN (p_patch->>'telefono')               ELSE u.telefono END,
        password_hash     = CASE WHEN p_patch ? 'password_hash'     THEN (p_patch->>'password_hash')          ELSE u.password_hash END,
        nombre            = CASE WHEN p_patch ? 'nombre'            THEN (p_patch->>'nombre')                 ELSE u.nombre END,
        apellido          = CASE WHEN p_patch ? 'apellido'          THEN (p_patch->>'apellido')               ELSE u.apellido END,
        sexo              = CASE WHEN p_patch ? 'sexo'              THEN (p_patch->>'sexo')                   ELSE u.sexo END,
        fecha_nacimiento  = CASE WHEN p_patch ? 'fecha_nacimiento'  THEN (p_patch->>'fecha_nacimiento')::date ELSE u.fecha_nacimiento END,
        foto_perfil_link  = CASE WHEN p_patch ? 'foto_perfil_link'  THEN (p_patch->>'foto_perfil_link')       ELSE u.foto_perfil_link END,
        foto_portada_link = CASE WHEN p_patch ? 'foto_portada_link' THEN (p_patch->>'foto_portada_link')      ELSE u.foto_portada_link END,
        updated_at        = CURRENT_TIMESTAMP
    WHERE u.user_id = p_user_id
    RETURNING * INTO v_u_new;

    ------------------------------------------------------------------
    -- 5) UPDATE hija: usuarios.usuario_terapeuta
    ------------------------------------------------------------------
    UPDATE usuarios.usuario_terapeuta t
    SET
        titulo_profesional     = CASE WHEN p_patch ? 'titulo_profesional'     THEN (p_patch->>'titulo_profesional')     ELSE t.titulo_profesional END,
        especialidad_principal = CASE WHEN p_patch ? 'especialidad_principal' THEN (p_patch->>'especialidad_principal') ELSE t.especialidad_principal END,
        descripcion_perfil     = CASE WHEN p_patch ? 'descripcion_perfil'     THEN (p_patch->>'descripcion_perfil')     ELSE t.descripcion_perfil END,
        frase_personal         = CASE WHEN p_patch ? 'frase_personal'         THEN (p_patch->>'frase_personal')         ELSE t.frase_personal END,
        link_video_youtube     = CASE WHEN p_patch ? 'link_video_youtube'     THEN (p_patch->>'link_video_youtube')     ELSE t.link_video_youtube END,
        matricula_profesional  = CASE WHEN p_patch ? 'matricula_profesional'  THEN (p_patch->>'matricula_profesional')  ELSE t.matricula_profesional END,
        pais                   = CASE WHEN p_patch ? 'pais'                   THEN (p_patch->>'pais')                   ELSE t.pais END,
        ciudad                 = CASE WHEN p_patch ? 'ciudad'                 THEN (p_patch->>'ciudad')                 ELSE t.ciudad END,
        valor_sesion_base      = CASE WHEN p_patch ? 'valor_sesion_base'      THEN (p_patch->>'valor_sesion_base')::numeric ELSE t.valor_sesion_base END,
        updated_at             = CURRENT_TIMESTAMP
    WHERE t.user_id = p_user_id
    RETURNING * INTO v_t_new;

    ------------------------------------------------------------------
    -- 6) Log único
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
    VALUES (
        p_id_sesion, p_actor_user_id,
        'UPDATE_TERAPEUTA_FULL','usuario_terapeuta',p_user_id,
        jsonb_build_object(
            'patch', p_patch,
            'old', jsonb_build_object(
                'usuario', to_jsonb(v_u_old),
                'usuario_terapeuta', to_jsonb(v_t_old)
            ),
            'new', jsonb_build_object(
                'usuario', to_jsonb(v_u_new),
                'usuario_terapeuta', to_jsonb(v_t_new)
            )
        )
    );

    RETURN QUERY
    SELECT
        'ok', NULL::text, 'Terapeuta actualizado correctamente (usuario + terapeuta)',
        jsonb_build_object(
            'user_id', p_user_id,
            'usuario', to_jsonb(v_u_new),
            'usuario_terapeuta', to_jsonb(v_t_new)
        );
    RETURN;

EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_TERAPEUTA_FULL_ERROR','usuario_terapeuta',p_user_id,
            jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE,'patch',p_patch)
        );

        RETURN QUERY
        SELECT 'error','INTERNAL_ERROR','Error interno al actualizar terapeuta',
               jsonb_build_object('error_message',SQLERRM,'error_code',SQLSTATE);
        RETURN;
END;
$$;

DROP INDEX IF EXISTS terapia.idx_horario_terapeuta_unique;

CREATE UNIQUE INDEX idx_horario_terapeuta_unique
ON terapia.horario_terapeuta (id_usuario_terapeuta, dia_semana, hora_inicio, hora_fin)
WHERE register_status = 'Activo';

CREATE OR REPLACE FUNCTION terapia.fn_actualizar_horario_terapeuta_versionado(
    p_actor_user_id        integer,
    p_id_sesion            integer,
    p_id_horario_terapeuta integer,
    p_patch                jsonb
)
RETURNS TABLE(status text, type_error text, message text, data jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
    v_old terapia.horario_terapeuta%ROWTYPE;
    v_new terapia.horario_terapeuta%ROWTYPE;

    v_allowed text[] := ARRAY[
        'dia_semana','hora_inicio','hora_fin','es_laboral','tipo_atencion',
        'canal','ubicacion','metadata'
    ];

    v_is_admin boolean := false;
    v_is_super boolean := false;
    v_admin_terapeuta integer;

    v_changed jsonb := '{}'::jsonb;
    v_kept    jsonb := '{}'::jsonb;
    v_has_change boolean := false;
    v_f text;
BEGIN
    ------------------------------------------------------------------
    -- 0) sesión
    ------------------------------------------------------------------
    IF p_id_sesion IS NULL THEN
        RETURN QUERY SELECT 'error','MISSING_SESSION','Se requiere id_sesion para registrar el log',NULL::jsonb;
        RETURN;
    END IF;

    PERFORM 1
    FROM seguridad.sesion s
    WHERE s.id_sesion = p_id_sesion
      AND s.user_id   = p_actor_user_id
      AND s.register_status = 'Activo'
      AND s.timestamp_logout IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'error','INVALID_SESSION','Sesión inválida o expirada',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 1) patch
    ------------------------------------------------------------------
    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RETURN QUERY SELECT 'error','INVALID_PATCH','p_patch debe ser un JSON object',NULL::jsonb;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_object_keys(p_patch) k
        WHERE k <> ALL(v_allowed)
    ) THEN
        RETURN QUERY
        SELECT 'error','PATCH_NOT_ALLOWED','p_patch contiene campos no permitidos',
               jsonb_build_object('allowed', v_allowed);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 2) cargar horario (lock)
    ------------------------------------------------------------------
    SELECT *
    INTO v_old
    FROM terapia.horario_terapeuta h
    WHERE h.id_horario_terapeuta = p_id_horario_terapeuta
      AND h.register_status = 'Activo'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 'error','HORARIO_NOT_FOUND','Horario no existe o no está activo',
               jsonb_build_object('id_horario_terapeuta', p_id_horario_terapeuta);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 3) permisos (terapeuta dueño o admin asignado/super)
    ------------------------------------------------------------------
    SELECT
        true,
        COALESCE(a.is_super_admin,false),
        a.id_usuario_terapeuta
    INTO v_is_admin, v_is_super, v_admin_terapeuta
    FROM usuarios.usuario_admin a
    WHERE a.user_id = p_actor_user_id
      AND a.register_status = 'Activo'
    LIMIT 1;

    IF NOT FOUND THEN
        v_is_admin := false; v_is_super := false; v_admin_terapeuta := NULL;
    END IF;

    IF NOT (
        p_actor_user_id = v_old.id_usuario_terapeuta
        OR (v_is_admin AND (v_is_super OR v_admin_terapeuta = v_old.id_usuario_terapeuta))
    ) THEN
        INSERT INTO seguridad.action_log(id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles)
        VALUES (
            p_id_sesion, p_actor_user_id,
            'UPDATE_HORARIO_VERSIONADO_DENEGADO','horario_terapeuta',p_id_horario_terapeuta,
            jsonb_build_object('patch',p_patch,'id_usuario_terapeuta',v_old.id_usuario_terapeuta)
        );

        RETURN QUERY SELECT 'error','NOT_ALLOWED','No tienes permisos para actualizar este horario',NULL::jsonb;
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 4) diff: null/ausente => se conserva
    ------------------------------------------------------------------
    FOREACH v_f IN ARRAY v_allowed LOOP
        IF (p_patch ? v_f) AND jsonb_typeof(p_patch->v_f) <> 'null' THEN
            v_changed := v_changed || jsonb_build_object(v_f, p_patch->v_f);
            v_has_change := true;
        ELSE
            v_kept := v_kept || jsonb_build_object(v_f, to_jsonb(v_old)->v_f);
        END IF;
    END LOOP;

    IF NOT v_has_change THEN
        RETURN QUERY SELECT 'error','NO_CHANGES','No hay campos nuevos (no-null) para versionar',
            jsonb_build_object('patch',p_patch);
        RETURN;
    END IF;

    ------------------------------------------------------------------
    -- 5) apagar anterior
    ------------------------------------------------------------------
    UPDATE terapia.horario_terapeuta
    SET register_status = 'Inactivo',
        updated_at = now()
    WHERE id_horario_terapeuta = v_old.id_horario_terapeuta;

    ------------------------------------------------------------------
    -- 6) insertar nueva versión Activa
    ------------------------------------------------------------------
    INSERT INTO terapia.horario_terapeuta(
        id_usuario_terapeuta,
        dia_semana,
        hora_inicio,
        hora_fin,
        es_laboral,
        tipo_atencion,
        canal,
        ubicacion,
        metadata,
        register_status,
        id_version
    )
    VALUES (
        v_old.id_usuario_terapeuta,
        CASE WHEN (p_patch ? 'dia_semana') AND jsonb_typeof(p_patch->'dia_semana') <> 'null'
             THEN (p_patch->>'dia_semana')::smallint ELSE v_old.dia_semana END,
        CASE WHEN (p_patch ? 'hora_inicio') AND jsonb_typeof(p_patch->'hora_inicio') <> 'null'
             THEN (p_patch->>'hora_inicio')::time ELSE v_old.hora_inicio END,
        CASE WHEN (p_patch ? 'hora_fin') AND jsonb_typeof(p_patch->'hora_fin') <> 'null'
             THEN (p_patch->>'hora_fin')::time ELSE v_old.hora_fin END,
        CASE WHEN (p_patch ? 'es_laboral') AND jsonb_typeof(p_patch->'es_laboral') <> 'null'
             THEN (p_patch->>'es_laboral')::boolean ELSE v_old.es_laboral END,
        CASE WHEN (p_patch ? 'tipo_atencion') AND jsonb_typeof(p_patch->'tipo_atencion') <> 'null'
             THEN (p_patch->>'tipo_atencion') ELSE v_old.tipo_atencion END,
        CASE WHEN (p_patch ? 'canal') AND jsonb_typeof(p_patch->'canal') <> 'null'
             THEN (p_patch->>'canal') ELSE v_old.canal END,
        CASE WHEN (p_patch ? 'ubicacion') AND jsonb_typeof(p_patch->'ubicacion') <> 'null'
             THEN (p_patch->>'ubicacion') ELSE v_old.ubicacion END,
        CASE WHEN (p_patch ? 'metadata') AND jsonb_typeof(p_patch->'metadata') <> 'null'
             THEN (p_patch->'metadata') ELSE v_old.metadata END,
        'Activo',
        v_old.id_version + 1
    )
    RETURNING *
    INTO v_new;

    ------------------------------------------------------------------
    -- 7) log
    ------------------------------------------------------------------
    INSERT INTO seguridad.action_log(
        id_sesion,user_id,tipo_accion,tipo_contenedor,id_contenedor,detalles
    )
    VALUES (
        p_id_sesion,
        p_actor_user_id,
        'UPDATE_HORARIO_VERSIONADO',
        'horario_terapeuta',
        v_new.id_horario_terapeuta,
        jsonb_build_object(
            'old', to_jsonb(v_old),
            'new', to_jsonb(v_new),
            'kept', v_kept,
            'changed', v_changed
        )
    );

    RETURN QUERY
    SELECT
        'ok', NULL::text, 'Horario versionado correctamente',
        jsonb_build_object(
            'old_id_horario_terapeuta', v_old.id_horario_terapeuta,
            'new_id_horario_terapeuta', v_new.id_horario_terapeuta,
            'horario', to_jsonb(v_new),
            'kept', v_kept,
            'changed', v_changed
        );
END;
$$;



CREATE OR REPLACE FUNCTION mensajeria.fn_enqueue_outbox_message(
  p_tipo         text,
  p_para         text,
  p_payload      jsonb DEFAULT '{}'::jsonb,
  p_template_key text DEFAULT NULL,
  p_canal        text DEFAULT 'EMAIL',
  p_prioridad    smallint DEFAULT 5,
  p_next_run_at  timestamptz DEFAULT NULL,
  p_max_intentos integer DEFAULT 6
)
RETURNS TABLE (
  ok boolean,
  message text,
  id_mensaje bigint,
  estado text,
  next_run_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id bigint;
  v_now timestamptz := now();
BEGIN
  -- Validaciones mínimas
  IF p_tipo IS NULL OR btrim(p_tipo) = '' THEN
    RETURN QUERY SELECT false, 'p_tipo requerido', NULL::bigint, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  IF p_para IS NULL OR btrim(p_para) = '' THEN
    RETURN QUERY SELECT false, 'p_para requerido', NULL::bigint, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO mensajeria.mensaje_outbox(
    tipo, canal, prioridad,
    para, template_key, payload,
    estado, intentos, max_intentos,
    next_run_at, locked_at, locked_by,
    last_error, created_at, sent_at
  )
  VALUES (
    btrim(p_tipo),
    COALESCE(NULLIF(btrim(p_canal), ''), 'EMAIL'),
    COALESCE(p_prioridad, 5),

    btrim(p_para),
    NULLIF(btrim(p_template_key), ''),
    COALESCE(p_payload, '{}'::jsonb),

    'PENDIENTE', 0, COALESCE(p_max_intentos, 6),
    COALESCE(p_next_run_at, v_now),
    NULL, NULL,
    NULL, v_now, NULL
  )
  RETURNING id_mensaje INTO v_id;

  RETURN QUERY
  SELECT true, 'Encolado', v_id, 'PENDIENTE', COALESCE(p_next_run_at, v_now), v_now;
END;
$$;



CREATE OR REPLACE FUNCTION mensajeria.fn_lock_next_outbox_batch(
  p_limit integer,
  p_locked_by text 
)
RETURNS SETOF mensajeria.mensaje_outbox
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id_mensaje
    FROM mensajeria.mensaje_outbox
    WHERE estado = 'PENDIENTE'
      AND next_run_at <= now()
      AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes')
    ORDER BY prioridad ASC, next_run_at ASC, id_mensaje ASC
    FOR UPDATE SKIP LOCKED
    LIMIT COALESCE(p_limit, 10)
  )
  UPDATE mensajeria.mensaje_outbox o
  SET estado = 'PROCESANDO',
      locked_at = now(),
      locked_by = p_locked_by
  WHERE o.id_mensaje IN (SELECT id_mensaje FROM cte)
  RETURNING o.*;
END;
$$;


CREATE OR REPLACE FUNCTION mensajeria.fn_set_outbox_state(
  p_id_mensaje      bigint,
  p_action          text,                 -- 'SENT' | 'FAILED' | 'RETRY' | 'CANCEL' | 'UNLOCK'
  p_attempts        integer DEFAULT NULL, -- para FAILED/RETRY
  p_last_error      text DEFAULT NULL,
  p_max_attempts    integer DEFAULT NULL, -- si no lo pasas, usa el de la fila
  p_locked_by       text DEFAULT NULL,    -- para UNLOCK o si quieres validar quien lo tiene
  p_provider_id     text DEFAULT NULL,    -- opcional (si quieres registrar)
  p_response        jsonb DEFAULT NULL    -- opcional (si quieres registrar)
)
RETURNS TABLE (
  ok boolean,
  message text,
  id_mensaje bigint,
  estado text,
  next_run_at timestamptz,
  sent_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := now();
  v_row mensajeria.mensaje_outbox%rowtype;
  v_action text := upper(btrim(coalesce(p_action,'')));
  v_attempts integer;
  v_max integer;
  v_terminal boolean;
  v_backoff_mins integer;
  v_next_run timestamptz;
  v_err text;
BEGIN
  IF p_id_mensaje IS NULL THEN
    RETURN QUERY SELECT false, 'p_id_mensaje requerido', NULL::bigint, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_action = '' THEN
    RETURN QUERY SELECT false, 'p_action requerido', p_id_mensaje, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  -- Traer fila actual (lock row)
  SELECT * INTO v_row
  FROM mensajeria.mensaje_outbox
  WHERE id_mensaje = p_id_mensaje
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No existe id_mensaje', p_id_mensaje, NULL::text, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  -- Normaliza error
  v_err := COALESCE(p_last_error, '');
  IF length(v_err) > 2000 THEN
    v_err := left(v_err, 2000);
  END IF;

  -- Define attempts / max
  v_attempts := COALESCE(p_attempts, v_row.intentos);
  v_max := COALESCE(p_max_attempts, v_row.max_intentos, 6);

  -- Acciones
  IF v_action = 'SENT' THEN
    UPDATE mensajeria.mensaje_outbox
    SET estado='ENVIADO',
        sent_at=v_now,
        locked_at=NULL,
        locked_by=NULL,
        last_error=NULL
    WHERE id_mensaje=p_id_mensaje;

    RETURN QUERY
    SELECT true, 'OK', p_id_mensaje, 'ENVIADO', NULL::timestamptz, v_now;
    RETURN;

  ELSIF v_action IN ('FAILED','RETRY') THEN
    IF v_attempts IS NULL OR v_attempts < 1 THEN
      RETURN QUERY SELECT false, 'p_attempts requerido y >= 1 para FAILED/RETRY', p_id_mensaje, v_row.estado, v_row.next_run_at, v_row.sent_at;
      RETURN;
    END IF;

    v_terminal := (v_attempts >= v_max);

    -- backoff: mins = min(60, 2^attempts)
    v_backoff_mins := LEAST(60, (2 ^ v_attempts)::int);
    v_next_run := v_now + (v_backoff_mins || ' minutes')::interval;

    IF v_terminal THEN
      UPDATE mensajeria.mensaje_outbox
      SET estado='FALLIDO',
          intentos=v_attempts,
          last_error=NULLIF(v_err,''),
          locked_at=NULL,
          locked_by=NULL
      WHERE id_mensaje=p_id_mensaje;

      RETURN QUERY
      SELECT true, 'Terminal FAIL', p_id_mensaje, 'FALLIDO', NULL::timestamptz, v_row.sent_at;
      RETURN;
    ELSE
      UPDATE mensajeria.mensaje_outbox
      SET estado='PENDIENTE',
          intentos=v_attempts,
          last_error=NULLIF(v_err,''),
          next_run_at=v_next_run,
          locked_at=NULL,
          locked_by=NULL
      WHERE id_mensaje=p_id_mensaje;

      RETURN QUERY
      SELECT true, 'Requeued', p_id_mensaje, 'PENDIENTE', v_next_run, v_row.sent_at;
      RETURN;
    END IF;

  ELSIF v_action = 'CANCEL' THEN
    UPDATE mensajeria.mensaje_outbox
    SET estado='CANCELADO',
        locked_at=NULL,
        locked_by=NULL
    WHERE id_mensaje=p_id_mensaje;

    RETURN QUERY
    SELECT true, 'OK', p_id_mensaje, 'CANCELADO', NULL::timestamptz, v_row.sent_at;
    RETURN;

  ELSIF v_action = 'UNLOCK' THEN
    -- opcional: si quieres validar quién lo libera
    IF p_locked_by IS NOT NULL AND v_row.locked_by IS NOT NULL AND v_row.locked_by <> p_locked_by THEN
      RETURN QUERY SELECT false, 'locked_by no coincide', p_id_mensaje, v_row.estado, v_row.next_run_at, v_row.sent_at;
      RETURN;
    END IF;

    UPDATE mensajeria.mensaje_outbox
    SET estado='PENDIENTE',
        locked_at=NULL,
        locked_by=NULL
    WHERE id_mensaje=p_id_mensaje;

    RETURN QUERY
    SELECT true, 'OK', p_id_mensaje, 'PENDIENTE', v_row.next_run_at, v_row.sent_at;
    RETURN;

  ELSE
    RETURN QUERY SELECT false, 'Accion no soportada', p_id_mensaje, v_row.estado, v_row.next_run_at, v_row.sent_at;
    RETURN;
  END IF;
END;
$$;



CREATE OR REPLACE FUNCTION mensajeria.fn_log_outbox_send(
  p_id_mensaje bigint,
  p_ok boolean,
  p_provider_id text DEFAULT NULL,
  p_respuesta jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS TABLE (
  ok boolean,
  message text,
  id_log bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_log bigint;
  v_err text;
BEGIN
  IF p_id_mensaje IS NULL THEN
    RETURN QUERY SELECT false, 'p_id_mensaje requerido', NULL::bigint;
    RETURN;
  END IF;

  IF p_ok IS NULL THEN
    RETURN QUERY SELECT false, 'p_ok requerido', NULL::bigint;
    RETURN;
  END IF;

  v_err := COALESCE(p_error, '');
  IF length(v_err) > 2000 THEN
    v_err := left(v_err, 2000);
  END IF;

  INSERT INTO mensajeria.mensaje_envio_log(id_mensaje, ok, provider_id, respuesta, error)
  VALUES (p_id_mensaje, p_ok, p_provider_id, p_respuesta, NULLIF(v_err, ''))
  RETURNING id_log INTO v_id_log;

  RETURN QUERY SELECT true, 'OK', v_id_log;
END;
$$;
