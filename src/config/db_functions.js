export const DB_FUNCTIONS = {
  "seguridad.fn_verificar_auth_pin": {
    "name": "seguridad.fn_verificar_auth_pin",
    "params": [
      {
        "name": "p_email",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_tipo_pin",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_pin_code",
        "type": "text",
        "hasDefault": false
      }
    ]
  },
  "usuarios.fn_signup_paciente_with_verification_pin": {
    "name": "usuarios.fn_signup_paciente_with_verification_pin",
    "params": [
      {
        "name": "p_email",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_password",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_nombre",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_apellido",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_telefono",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_sexo",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_fecha_nacimiento",
        "type": "date",
        "hasDefault": true
      },
      {
        "name": "p_pais",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_ciudad",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_ocupacion",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_perfil_psicologico",
        "type": "jsonb",
        "hasDefault": true
      },
      {
        "name": "p_pin_life_time",
        "type": "interval",
        "hasDefault": true
      },
      {
        "name": "p_pin_contexto",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_pin_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "usuarios.fn_signup_terapeuta_with_verification_pin": {
    "name": "usuarios.fn_signup_terapeuta_with_verification_pin",
    "params": [
      {
        "name": "p_email",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_password",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_nombre",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_apellido",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_telefono",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_sexo",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_fecha_nacimiento",
        "type": "date",
        "hasDefault": true
      },
      {
        "name": "p_titulo_profesional",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_especialidad_princ",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_descripcion_perfil",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_frase_personal",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_link_video_youtube",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_matricula_profesional",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_pais",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_ciudad",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_valor_sesion_base",
        "type": "numeric",
        "hasDefault": true
      },
      {
        "name": "p_pin_life_time",
        "type": "interval",
        "hasDefault": true
      },
      {
        "name": "p_pin_contexto",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_pin_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "usuarios.fn_signup_admin_with_verification_pin": {
    "name": "usuarios.fn_signup_admin_with_verification_pin",
    "params": [
      {
        "name": "p_email",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_password",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_nombre",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_apellido",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_telefono",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_sexo",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_fecha_nacimiento",
        "type": "date",
        "hasDefault": true
      },
      {
        "name": "p_id_usuario_terapeuta",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_nivel",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_is_super_admin",
        "type": "boolean",
        "hasDefault": true
      },
      {
        "name": "p_can_manage_files",
        "type": "boolean",
        "hasDefault": true
      },
      {
        "name": "p_is_accounter",
        "type": "boolean",
        "hasDefault": true
      },
      {
        "name": "p_pin_life_time",
        "type": "interval",
        "hasDefault": true
      },
      {
        "name": "p_pin_contexto",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_pin_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "seguridad.fn_logout_user_sessions": {
    "name": "seguridad.fn_logout_user_sessions",
    "params": [
      {
        "name": "p_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_tipo_logout",
        "type": "text",
        "hasDefault": true
      }
    ]
  },
  "usuarios.fn_login_password": {
    "name": "usuarios.fn_login_password",
    "params": [
      {
        "name": "p_email",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_password",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_ip_acceso",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_user_agent",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_tipo_login",
        "type": "text",
        "hasDefault": true
      }
    ]
  },
  "terapia.fn_crear_enfoque": {
    "name": "terapia.fn_crear_enfoque",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_nombre",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_descripcion",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "terapia.fn_crear_producto": {
    "name": "terapia.fn_crear_producto",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_nombre",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_descripcion",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_id_enfoque_default",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_duracion_minutos",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_precio_base",
        "type": "numeric(12,2)",
        "hasDefault": true
      },
      {
        "name": "p_costo_base",
        "type": "numeric(12,2)",
        "hasDefault": true
      },
      {
        "name": "p_categoria",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "terapia.fn_crear_horario_terapeuta": {
    "name": "terapia.fn_crear_horario_terapeuta",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_usuario_terapeuta",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_dia_semana",
        "type": "smallint",
        "hasDefault": false
      },
      {
        "name": "p_hora_inicio",
        "type": "time",
        "hasDefault": false
      },
      {
        "name": "p_hora_fin",
        "type": "time",
        "hasDefault": false
      },
      {
        "name": "p_tipo_atencion",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_canal",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_ubicacion",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "terapia.fn_crear_bloqueo_agenda": {
    "name": "terapia.fn_crear_bloqueo_agenda",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_usuario_terapeuta",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_inicio",
        "type": "timestamptz",
        "hasDefault": false
      },
      {
        "name": "p_fin",
        "type": "timestamptz",
        "hasDefault": false
      },
      {
        "name": "p_tipo_bloqueo",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_motivo",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "terapia.fn_listar_enfoques": {
    "name": "terapia.fn_listar_enfoques",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_limit",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_offset",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_only_activos",
        "type": "boolean",
        "hasDefault": true
      }
    ]
  },
  "terapia.fn_listar_productos": {
    "name": "terapia.fn_listar_productos",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_limit",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_offset",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_only_activos",
        "type": "boolean",
        "hasDefault": true
      }
    ]
  },
  "contabilidad.fn_registrar_grupo_cuenta": {
    "name": "contabilidad.fn_registrar_grupo_cuenta",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_nombre",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_codigo",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_id_grupo_padre",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_tipo_grupo",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "contabilidad.fn_registrar_cuenta": {
    "name": "contabilidad.fn_registrar_cuenta",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_nombre",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_id_grupo_cuenta",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_codigo",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_tipo_cuenta",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_sub_tipo",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_categoria",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_moneda",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "contabilidad.fn_registrar_transaccion": {
    "name": "contabilidad.fn_registrar_transaccion",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_fecha",
        "type": "date",
        "hasDefault": true
      },
      {
        "name": "p_tipo_transaccion",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_glosa",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_referencia_externa",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_metadata",
        "type": "jsonb",
        "hasDefault": true
      },
      {
        "name": "p_movimientos",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "contabilidad.fn_listar_grupos_cuenta": {
    "name": "contabilidad.fn_listar_grupos_cuenta",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_limit",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_offset",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_only_activos",
        "type": "boolean",
        "hasDefault": true
      }
    ]
  },
  "contabilidad.fn_listar_cuentas": {
    "name": "contabilidad.fn_listar_cuentas",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_limit",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_offset",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_only_activos",
        "type": "boolean",
        "hasDefault": true
      },
      {
        "name": "p_id_grupo_cuenta",
        "type": "integer",
        "hasDefault": true
      }
    ]
  },
  "seguridad.fn_registrar_visita_publica": {
    "name": "seguridad.fn_registrar_visita_publica",
    "params": [
      {
        "name": "p_ip_acceso",
        "type": "inet",
        "hasDefault": false
      },
      {
        "name": "p_user_agent",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_metodo_http",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_path",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_query_string",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_referrer",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_session_public_id",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_pais",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_device_type",
        "type": "text",
        "hasDefault": true
      },
      {
        "name": "p_metadata",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "analytics.fn_registrar_ui_events_bulk": {
    "name": "analytics.fn_registrar_ui_events_bulk",
    "params": [
      {
        "name": "p_session_public_id",
        "type": "text",
        "hasDefault": false
      },
      {
        "name": "p_user_id",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_events",
        "type": "jsonb",
        "hasDefault": true
      }
    ]
  },
  "terapia.fn_obtener_horarios_terapeuta": {
    "name": "terapia.fn_obtener_horarios_terapeuta",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_usuario_terapeuta",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_only_activos",
        "type": "boolean",
        "hasDefault": true
      },
      {
        "name": "p_limit",
        "type": "integer",
        "hasDefault": true
      },
      {
        "name": "p_offset",
        "type": "integer",
        "hasDefault": true
      }
    ]
  },
  "usuarios.fn_update_paciente_full": {
    "name": "usuarios.fn_update_paciente_full",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_patch",
        "type": "jsonb",
        "hasDefault": false
      }
    ]
  },
  "terapia.fn_update_enfoque": {
    "name": "terapia.fn_update_enfoque",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_enfoque",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_patch",
        "type": "jsonb",
        "hasDefault": false
      }
    ]
  },
  "terapia.fn_update_producto": {
    "name": "terapia.fn_update_producto",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_producto",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_patch",
        "type": "jsonb",
        "hasDefault": false
      }
    ]
  },
  "usuarios.fn_update_terapeuta_full": {
    "name": "usuarios.fn_update_terapeuta_full",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_patch",
        "type": "jsonb",
        "hasDefault": false
      }
    ]
  },
  "terapia.fn_actualizar_horario_terapeuta_versionado": {
    "name": "terapia.fn_actualizar_horario_terapeuta_versionado",
    "params": [
      {
        "name": "p_actor_user_id",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_sesion",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_id_horario_terapeuta",
        "type": "integer",
        "hasDefault": false
      },
      {
        "name": "p_patch",
        "type": "jsonb",
        "hasDefault": false
      }
    ]
  },
  "mensajeria.fn_enqueue_outbox_message": {
    name : "mensajeria.fn_enqueue_outbox_message",
    params: [
      { name: "p_tipo", type: "text", hasDefault: false },
      { name: "p_para", type: "text", hasDefault: false },
      { name: "p_payload", type: "jsonb", hasDefault: true },
      { name: "p_template_key", type: "text", hasDefault: true },
      { name: "p_canal", type: "text", hasDefault: true },
      { name: "p_prioridad", type: "smallint", hasDefault: true },
      { name: "p_next_run_at", type: "timestamptz", hasDefault: true },
      { name: "p_max_intentos", type: "integer", hasDefault: true },
    ],
  },
  "mensajeria.fn_lock_next_outbox_batch": {
    params: [
      { name: "p_limit", type: "integer", hasDefault: true },
      { name: "p_locked_by", type: "text", hasDefault: false },
    ],
  },
  "mensajeria.fn_set_outbox_state": {
    name :"mensajeria.fn_set_outbox_state",
    params: [
      { name: "p_id_mensaje", type: "bigint", hasDefault: false },
      { name: "p_action", type: "text", hasDefault: false },

      { name: "p_attempts", type: "integer", hasDefault: true },
      { name: "p_last_error", type: "text", hasDefault: true },
      { name: "p_max_attempts", type: "integer", hasDefault: true },
      { name: "p_locked_by", type: "text", hasDefault: true },
      { name: "p_provider_id", type: "text", hasDefault: true },
      { name: "p_response", type: "jsonb", hasDefault: true },
    ],
  },
  "mensajeria.fn_log_outbox_send": {
    name : "mensajeria.fn_log_outbox_send",
    params: [
      { name: "p_id_mensaje", type: "bigint", hasDefault: false },
      { name: "p_ok", type: "boolean", hasDefault: false },
      { name: "p_provider_id", type: "text", hasDefault: true },
      { name: "p_respuesta", type: "jsonb", hasDefault: true },
      { name: "p_error", type: "text", hasDefault: true },
    ],
  },
  
  "terapia.fn_registrar_cita": {
    "name": "terapia.fn_registrar_cita",
    "params": [
      { "name": "p_actor_user_id",        "type": "integer",     "hasDefault": false },
      { "name": "p_id_sesion",            "type": "integer",     "hasDefault": false },

      { "name": "p_id_producto",          "type": "integer",     "hasDefault": false },
      { "name": "p_id_usuario_terapeuta", "type": "integer",     "hasDefault": false },
      { "name": "p_id_usuario_paciente",  "type": "integer",     "hasDefault": false },

      { "name": "p_inicio",               "type": "timestamptz", "hasDefault": false },
      { "name": "p_fin",                  "type": "timestamptz", "hasDefault": true  },

      { "name": "p_id_enfoque",           "type": "integer",     "hasDefault": true  },
      { "name": "p_canal",                "type": "text",        "hasDefault": true  },
      { "name": "p_enlace_sesion",        "type": "text",        "hasDefault": true  },
      { "name": "p_direccion",            "type": "text",        "hasDefault": true  },
      { "name": "p_notas_internas",       "type": "text",        "hasDefault": true  }
    ]
  },

  "terapia.fn_actualizar_detalle_cita": {
    "name": "terapia.fn_actualizar_detalle_cita",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_id_cita",       "type": "integer", "hasDefault": false },
      { "name": "p_patch",         "type": "jsonb",   "hasDefault": false },
      { "name": "p_motivo",        "type": "text",    "hasDefault": true  }
    ]
  },

  "terapia.fn_listar_solicitudes_cita_admin": {
    "name": "terapia.fn_listar_solicitudes_cita_admin",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_limit",         "type": "integer", "hasDefault": true  },
      { "name": "p_offset",        "type": "integer", "hasDefault": true  },
      
      { "name": "p_id_usuario_paciente",        "type": "integer", "hasDefault": true  },
      { "name": "p_id_usuario_terapeuta",        "type": "integer", "hasDefault": true  },

    ]
  },

  "seguridad.fn_solicitar_nuevo_auth_pin": {
    "name": "seguridad.fn_solicitar_nuevo_auth_pin",
    "params": [
      { "name": "p_email",     "type": "text",     "hasDefault": false },
      { "name": "p_tipo_pin",  "type": "text",     "hasDefault": true  },
      { "name": "p_life_time", "type": "interval", "hasDefault": true  },
      { "name": "p_contexto",  "type": "text",     "hasDefault": true  },
      { "name": "p_metadata",  "type": "jsonb",    "hasDefault": true  }
    ]
  },
  "usuarios.api_get_terapeutas_sin_admin_activo": {
    "name": "usuarios.api_get_terapeutas_sin_admin_activo",
    "params": []
  },

  "usuarios.fn_super_set_usuario_estado": {
    name: "usuarios.fn_super_set_usuario_estado",
    params: [
      { name: "p_actor_user_id",  type: "integer", hasDefault: false },
      { name: "p_id_sesion",      type: "integer", hasDefault: false },
      { name: "p_target_user_id", type: "integer", hasDefault: false },
      { name: "p_activo",         type: "boolean", hasDefault: false }
    ]
  },

  "usuarios.fn_super_listar_usuarios_estado": {
    name: "usuarios.fn_super_listar_usuarios_estado",
    params: [
      { name: "p_actor_user_id", type: "integer", hasDefault: false },
      { name: "p_id_sesion",     type: "integer", hasDefault: false },
      { name: "p_limit",         type: "integer", hasDefault: true }  // si tu fn tiene DEFAULT
    ]
  },

  "terapia.fn_actualizar_estado_cita": {
    "name": "terapia.fn_actualizar_estado_cita",
    "params": [
      { "name": "p_actor_user_id",        "type": "integer",     "hasDefault": false },
      { "name": "p_id_sesion",            "type": "integer",     "hasDefault": false },
      { "name": "p_id_cita",              "type": "integer",     "hasDefault": false },
      { "name": "p_nuevo_estado",         "type": "text",        "hasDefault": false },
      { "name": "p_motivo",               "type": "text",        "hasDefault": true  }
    ]
  },

  "terapia.obtener_horarios_disponibles_2_semanas" : {
    "name": "terapia.obtener_horarios_disponibles_2_semanas",
    "params": [
      { "name": "p_id_usuario_terapeuta", "type": "integer",     "hasDefault": false },
    ]
  }, 

  "terapia.fn_booking_bootstrap": {
    "name": "terapia.fn_booking_bootstrap",
    "params": [
      { "name": "p_actor_user_id",      "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",          "type": "integer", "hasDefault": false },
      { "name": "p_incluir_horarios",   "type": "boolean", "hasDefault": true  }
    ]
  },
  
  "terapia.fn_enfoque_producto_bootstrap": {
    "name": "terapia.fn_enfoque_producto_bootstrap",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_only_activos", "type": "boolean", "hasDefault": true }
    ]
  },

  "publico.fn_listar_elementos_ui": {
    "name": "publico.fn_listar_elementos_ui",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_id_pagina",     "type": "integer", "hasDefault": true  },
      { "name": "p_limit",     "type": "integer", "hasDefault": true  }
    ]
  },

  "publico.fn_get_elemento_ui": {
    "name": "publico.fn_get_elemento_ui",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_id_elemento",   "type": "integer", "hasDefault": false }
    ]
  },

  "publico.fn_crear_elemento_ui": {
    "name": "publico.fn_crear_elemento_ui",
    "params": [
      { "name": "p_actor_user_id",        "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",            "type": "integer", "hasDefault": false },
      { "name": "p_id_pagina",            "type": "integer", "hasDefault": false },
      { "name": "p_cod_elemento",         "type": "text",    "hasDefault": false },
      { "name": "p_tipo",                 "type": "text",    "hasDefault": false },
      { "name": "p_id_servidor_archivos", "type": "integer", "hasDefault": true  },
      { "name": "p_link",                 "type": "text",    "hasDefault": true  },
      { "name": "p_valor",                "type": "text",    "hasDefault": true  },
      { "name": "p_metadata",             "type": "jsonb",   "hasDefault": true  }
    ]
  },

  "publico.fn_actualizar_elemento_ui": {
    "name": "publico.fn_actualizar_elemento_ui",
    "params": [
      { "name": "p_actor_user_id",        "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",            "type": "integer", "hasDefault": false },
      { "name": "p_id_elemento",          "type": "integer", "hasDefault": false },
      { "name": "p_id_pagina",            "type": "integer", "hasDefault": false },
      { "name": "p_cod_elemento",         "type": "text",    "hasDefault": false },
      { "name": "p_tipo",                 "type": "text",    "hasDefault": false },
      { "name": "p_id_servidor_archivos", "type": "integer", "hasDefault": true  },
      { "name": "p_id_archivo",           "type": "bigint",  "hasDefault": true  },
      { "name": "p_link",                 "type": "text",    "hasDefault": true  },
      { "name": "p_valor",                "type": "text",    "hasDefault": true  },
      { "name": "p_metadata",             "type": "jsonb",   "hasDefault": true  }
    ]
  },


  "publico.fn_listar_paginas_ui": {
    "name": "publico.fn_listar_paginas_ui",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_only_activos",  "type": "boolean", "hasDefault": true  },
      { "name": "p_limit",         "type": "integer", "hasDefault": true  },
      { "name": "p_offset",        "type": "integer", "hasDefault": true  }
    ]
  },

  "publico.fn_get_pagina_ui": {
    "name": "publico.fn_get_pagina_ui",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_id_pagina",     "type": "integer", "hasDefault": false }
    ]
  },

  "publico.fn_crear_pagina_ui": {
    "name": "publico.fn_crear_pagina_ui",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_cod",           "type": "text",    "hasDefault": false },
      { "name": "p_titulo",        "type": "text",    "hasDefault": false },
      { "name": "p_ruta",          "type": "text",    "hasDefault": true  },
      { "name": "p_metadata",      "type": "jsonb",   "hasDefault": true  }
    ]
  },

  "publico.fn_actualizar_pagina_ui": {
    "name": "publico.fn_actualizar_pagina_ui",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_id_pagina",     "type": "integer", "hasDefault": false },
      { "name": "p_cod",           "type": "text",    "hasDefault": false },
      { "name": "p_titulo",        "type": "text",    "hasDefault": false },
      { "name": "p_ruta",          "type": "text",    "hasDefault": true  },
      { "name": "p_metadata",      "type": "jsonb",   "hasDefault": true  }
    ]
  },

  "publico.fn_apagar_pagina_ui": {
    "name": "publico.fn_apagar_pagina_ui",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_id_pagina",     "type": "integer", "hasDefault": false },
      { "name": "p_motivo",        "type": "text",    "hasDefault": true  }
    ]
  },

  "infraestructura.fn_listar_servidor_archivos": {
    "name": "infraestructura.fn_listar_servidor_archivos",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false }
    ]
  },

  "infraestructura.fn_archivo_registrar": {
    "name": "infraestructura.fn_archivo_registrar",
    "params": [
      { "name": "p_storage_key", "type": "text", "hasDefault": false },
      { "name": "p_path", "type": "text", "hasDefault": true },
      { "name": "p_url", "type": "text", "hasDefault": true },
      { "name": "p_nombre_original", "type": "text", "hasDefault": true },
      { "name": "p_mime_type", "type": "text", "hasDefault": true },
      { "name": "p_bytes", "type": "bigint", "hasDefault": true },
      { "name": "p_checksum_sha256", "type": "text", "hasDefault": true },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true }
    ]
  },

    "infraestructura.fn_archivo_apagar": {
    "name": "infraestructura.fn_archivo_apagar",
    "params": [
      { "name": "p_storage_key", "type": "text", "hasDefault": false },
      { "name": "p_path", "type": "text", "hasDefault": true },
      { "name": "p_url", "type": "text", "hasDefault": true },
      { "name": "p_motivo", "type": "text", "hasDefault": true },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true }
    ]
  },

  "usuarios.api_usuario_terapeuta_obtener": {
    "name": "usuarios.api_usuario_terapeuta_obtener",
    "params": [
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_user_id",     "type": "integer", "hasDefault": false },
      { "name": "p_incluir_inactivos",     "type": "integer", "hasDefault": true },
      
    ]
  },

  "usuarios.api_usuario_admin_obtener": {
    "name": "usuarios.api_usuario_admin_obtener",
    "params": [
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_user_id",     "type": "integer", "hasDefault": false },
      { "name": "p_incluir_inactivos",     "type": "integer", "hasDefault": true },
    ]
  },

  "terapia.api_producto_obtener": {
    "name": "terapia.api_producto_obtener",
    "params": [
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_producto",     "type": "integer", "hasDefault": false },
      { "name": "p_incluir_inactivos",     "type": "integer", "hasDefault": true },
    ]
  },

  "terapia.api_enfoque_obtener": {
    "name": "terapia.api_enfoque_obtener",
    "params": [
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_enfoque",     "type": "integer", "hasDefault": false },
      { "name": "p_incluir_inactivos",     "type": "integer", "hasDefault": true },
    ]
  },
  
  "publico.fn_ui_bootstrap": {
    "name": "publico.fn_ui_bootstrap",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
      { "name": "p_id_pagina",     "type": "integer", "hasDefault": true  }
    ]
  },
  // =========================
  // CONTABILIDAD (endpoints)
  // =========================

  "contabilidad.fn_editar_cuenta": {
    "name": "contabilidad.fn_editar_cuenta",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_cuenta", "type": "integer", "hasDefault": false },
      { "name": "p_nombre", "type": "text", "hasDefault": true },
      { "name": "p_codigo", "type": "text", "hasDefault": true },
      { "name": "p_id_grupo_cuenta", "type": "integer", "hasDefault": true },
      { "name": "p_tipo_cuenta", "type": "text", "hasDefault": true },
      { "name": "p_sub_tipo", "type": "text", "hasDefault": true },
      { "name": "p_categoria", "type": "text", "hasDefault": true },
      { "name": "p_moneda", "type": "text", "hasDefault": true },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true },
      { "name": "p_register_status", "type": "text", "hasDefault": true }
    ]
  },

  "contabilidad.fn_editar_grupo_cuenta": {
    "name": "contabilidad.fn_editar_grupo_cuenta",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_grupo_cuenta", "type": "integer", "hasDefault": false },
      { "name": "p_nombre", "type": "text", "hasDefault": true },
      { "name": "p_codigo", "type": "text", "hasDefault": true },
      { "name": "p_id_grupo_padre", "type": "integer", "hasDefault": true },
      { "name": "p_tipo_grupo", "type": "text", "hasDefault": true },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true },
      { "name": "p_register_status", "type": "text", "hasDefault": true }
    ]
  },

  "contabilidad.fn_listar_centros_costo": {
    "name": "contabilidad.fn_listar_centros_costo",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_limit", "type": "integer", "hasDefault": true },
      { "name": "p_offset", "type": "integer", "hasDefault": true },
      { "name": "p_only_activos", "type": "boolean", "hasDefault": true }
    ]
  },

  "contabilidad.fn_registrar_centro_costo": {
    "name": "contabilidad.fn_registrar_centro_costo",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_nombre", "type": "text", "hasDefault": false },
      { "name": "p_codigo", "type": "text", "hasDefault": true },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true }
    ]
  },

  "contabilidad.fn_editar_centro_costo": {
    "name": "contabilidad.fn_editar_centro_costo",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_centro_costo", "type": "integer", "hasDefault": false },
      { "name": "p_nombre", "type": "text", "hasDefault": true },
      { "name": "p_codigo", "type": "text", "hasDefault": true },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true },
      { "name": "p_register_status", "type": "text", "hasDefault": true }
    ]
  },

  "contabilidad.fn_registrar_transacciones_batch": {
    "name": "contabilidad.fn_registrar_transacciones_batch",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_transacciones", "type": "jsonb", "hasDefault": false },
      { "name": "p_stop_on_error", "type": "boolean", "hasDefault": true }
    ]
  },

  "contabilidad.fn_listar_transacciones": {
    "name": "contabilidad.fn_listar_transacciones",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_limit", "type": "integer", "hasDefault": true },
      { "name": "p_offset", "type": "integer", "hasDefault": true },
      { "name": "p_fecha_desde", "type": "date", "hasDefault": true },
      { "name": "p_fecha_hasta", "type": "date", "hasDefault": true },
      { "name": "p_tipo_transaccion", "type": "text", "hasDefault": true },
      { "name": "p_id_cuenta", "type": "integer", "hasDefault": true }
    ]
  },
  "contabilidad.fn_listar_grupos_cuenta": {
    "name": "contabilidad.fn_listar_grupos_cuenta",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_limit", "type": "integer", "hasDefault": true },
      { "name": "p_offset", "type": "integer", "hasDefault": true }
    ]
  },

  "contabilidad.fn_registrar_grupo_cuenta": {
    "name": "contabilidad.fn_registrar_grupo_cuenta",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_nombre", "type": "text", "hasDefault": false },
      { "name": "p_codigo", "type": "text", "hasDefault": true },
      { "name": "p_id_grupo_padre", "type": "integer", "hasDefault": true },
      { "name": "p_tipo_grupo", "type": "text", "hasDefault": true },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true }
    ]
  },

  "contabilidad.fn_editar_grupo_cuenta": {
    "name": "contabilidad.fn_editar_grupo_cuenta",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_grupo_cuenta", "type": "integer", "hasDefault": false },
      { "name": "p_nombre", "type": "text", "hasDefault": true },
      { "name": "p_codigo", "type": "text", "hasDefault": true },
      { "name": "p_id_grupo_padre", "type": "integer", "hasDefault": true },
      { "name": "p_tipo_grupo", "type": "text", "hasDefault": true },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true },
      { "name": "p_register_status", "type": "text", "hasDefault": true }
    ]
  },
  "terapia.fn_apagar_enfoque": {
    "name": "terapia.fn_apagar_enfoque",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_enfoque", "type": "integer", "hasDefault": false }
    ]
  },
  "terapia.api_enfoque_apagar": {
    "name": "terapia.api_enfoque_apagar",
    "params": [
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_enfoque", "type": "integer", "hasDefault": false }
    ]
  },

  "terapia.fn_apagar_producto": {
    "name": "terapia.fn_apagar_producto",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_producto", "type": "integer", "hasDefault": false }
    ]
  },
  "terapia.api_producto_apagar": {
    "name": "terapia.api_producto_apagar",
    "params": [
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_producto", "type": "integer", "hasDefault": false }
    ]
  },

  "terapia.fn_apagar_horario_terapeuta": {
    "name": "terapia.fn_apagar_horario_terapeuta",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_horario_terapeuta", "type": "integer", "hasDefault": false }
    ]
  },
  "terapia.api_horario_terapeuta_apagar": {
    "name": "terapia.api_horario_terapeuta_apagar",
    "params": [
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_horario_terapeuta", "type": "integer", "hasDefault": false }
    ]
  },

  "terapia.fn_apagar_bloqueo_agenda": {
    "name": "terapia.fn_apagar_bloqueo_agenda",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_bloqueo", "type": "integer", "hasDefault": false }
    ]
  },
  "terapia.api_bloqueo_agenda_apagar": {
    "name": "terapia.api_bloqueo_agenda_apagar",
    "params": [
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_bloqueo", "type": "integer", "hasDefault": false }
    ]
  },

  "contabilidad.fn_apagar_grupo_cuenta": {
    "name": "contabilidad.fn_apagar_grupo_cuenta",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_grupo_cuenta", "type": "integer", "hasDefault": false },
      { "name": "p_motivo", "type": "text", "hasDefault": true }
    ]
  },
  
  "contabilidad.fn_apagar_cuenta": {
    "name": "contabilidad.fn_apagar_cuenta",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_cuenta", "type": "integer", "hasDefault": false },
      { "name": "p_motivo", "type": "text", "hasDefault": true }
    ]
  },
  
  "contabilidad.fn_apagar_centro_costo": {
    "name": "contabilidad.fn_apagar_centro_costo",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_centro_costo", "type": "integer", "hasDefault": false },
      { "name": "p_motivo", "type": "text", "hasDefault": true }
    ]
  },
  "contabilidad.fn_apagar_transaccion": {
    "name": "contabilidad.fn_apagar_transaccion",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_transaccion", "type": "integer", "hasDefault": false },
      { "name": "p_motivo", "type": "text", "hasDefault": true }
    ]
  },

  "publico.fn_apagar_elemento_ui": {
    "name": "publico.fn_apagar_elemento_ui",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_elemento", "type": "integer", "hasDefault": false },
      { "name": "p_motivo", "type": "text", "hasDefault": true }
    ]
  },

  "terapia.fn_apagar_cita": {
    "name": "terapia.fn_apagar_cita",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_cita", "type": "integer", "hasDefault": false },
      { "name": "p_motivo", "type": "text", "hasDefault": true }
    ]
  },
  "seguridad.fn_solicitar_pin_recuperacion_password": {
    "name": "seguridad.fn_solicitar_pin_recuperacion_password",
    "params": [
      { "name": "p_email",     "type": "text",     "hasDefault": false },
      { "name": "p_life_time", "type": "interval", "hasDefault": true  },
      { "name": "p_contexto",  "type": "text",     "hasDefault": true  },
      { "name": "p_metadata",  "type": "jsonb",    "hasDefault": true  }
    ]
  },
  "seguridad.fn_actualizar_password_recuperacion": {
    "name": "seguridad.fn_actualizar_password_recuperacion",
    "params": [
      { "name": "p_email", "type": "text", "hasDefault": false },
      { "name": "p_password", "type": "text", "hasDefault": false },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true }
    ]
  },
  "terapia.fn_enfoque_set_archivo": {
    "name": "terapia.fn_enfoque_set_archivo",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_id_enfoque", "type": "integer", "hasDefault": false },
      { "name": "p_id_archivo", "type": "integer", "hasDefault": false },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true }
    ]
  },
  "usuarios.fn_usuario_set_archivo": {
    "name": "usuarios.fn_usuario_set_archivo",
    "params": [
      { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_sesion", "type": "integer", "hasDefault": false },
      { "name": "p_target_user_id", "type": "integer", "hasDefault": false },
      { "name": "p_id_archivo", "type": "bigint", "hasDefault": false },
      { "name": "p_rol", "type": "text", "hasDefault": false },
      { "name": "p_metadata", "type": "jsonb", "hasDefault": true }
    ]
  },
  "usuarios.fn_update_admin_full": {
  "name": "usuarios.fn_update_admin_full",
  "params": [
    { "name": "p_actor_user_id", "type": "integer", "hasDefault": false },
    { "name": "p_id_sesion",     "type": "integer", "hasDefault": false },
    { "name": "p_user_id",       "type": "integer", "hasDefault": false },
    { "name": "p_patch",         "type": "jsonb",   "hasDefault": false }
  ],
},
  "contabilidad.fn_registrar_transaccion_venta": {
  "name": "contabilidad.fn_registrar_transaccion_venta",
  "params": [
    { "name": "p_actor_user_id",       "type": "integer", "hasDefault": false },
    { "name": "p_id_sesion",           "type": "integer", "hasDefault": false },
    { "name": "p_fecha",              "type": "date",    "hasDefault": false },
    { "name": "p_glosa",              "type": "text",    "hasDefault": false },
    { "name": "p_referencia_externa", "type": "text",    "hasDefault": false },
    { "name": "p_metadata",           "type": "jsonb",   "hasDefault": false },
    { "name": "p_movimientos",        "type": "jsonb",   "hasDefault": false },
    { "name": "p_cantidad",           "type": "integer", "hasDefault": false },
    { "name": "p_id_producto",        "type": "integer", "hasDefault": false },
    { "name": "p_id_cita",            "type": "integer", "hasDefault": true  }
  ]
},
  "publico.fn_get_pagina_publica_assets": {
    "name": "publico.fn_get_pagina_publica_assets",
    "params": [
      { "name": "p_id_pagina",  "type": "integer", "hasDefault": true },
      { "name": "p_cod_pagina", "type": "text",    "hasDefault": true }
    ]
  },

};

export const DB_FUNCTION_NAMES = Object.keys(DB_FUNCTIONS);
