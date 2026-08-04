/*
 * Modelo C4 del backend de Corazón Migrante.
 *
 * Es la fuente oficial de la arquitectura: los diagramas Mermaid que aparecen
 * dentro de la documentación son vistas parciales pensadas para leerse en
 * contexto, pero el modelo completo —con sus relaciones y tecnologías— vive
 * aquí y se versiona con el código.
 *
 * Render:  docker run --rm -p 8080:8080 -v "$PWD/structurizr:/usr/local/structurizr" structurizr/lite
 */
workspace "Corazón Migrante" "Plataforma de acompañamiento terapéutico para personas migrantes" {

    model {
        paciente   = person "Persona paciente"    "Reserva citas, consulta su agenda y accede a contenido premium."
        terapeuta  = person "Terapeuta"           "Declara su disponibilidad y atiende las citas asignadas."
        admin      = person "Equipo administrativo" "Aprueba terapeutas, publica contenido, gestiona campañas y contabilidad."
        visitante  = person "Visitante"           "Consulta el sitio público sin cuenta."

        hotmart    = softwareSystem "Hotmart" "Pasarela de venta de contenido descargable." "Externo"
        sendgrid   = softwareSystem "SendGrid" "Proveedor de correo transaccional." "Externo"
        gcs        = softwareSystem "Google Cloud Storage" "Almacenamiento de archivos." "Externo"
        cloudinary = softwareSystem "Cloudinary" "Almacenamiento de archivos alternativo." "Externo"
        otlp       = softwareSystem "Colector OTLP / Jaeger" "Recepción y consulta de trazas." "Externo"
        neon       = softwareSystem "Neon" "PostgreSQL gestionado, destino de las copias." "Externo"

        backend = softwareSystem "Backend Corazón Migrante" "Agenda terapéutica, contenidos, publicidad, descargables y administración." {

            api = container "API HTTP" "Expone 189 operaciones bajo /api/v1. Aplica autenticación, autorización y límite de peticiones." "NestJS 11 / Node 22" {
                guards       = component "Guards globales" "ThrottlerGuard, JwtAuthGuard, RolesGuard y PermissionsGuard, en ese orden." "NestJS APP_GUARD"
                interceptors = component "Interceptores globales" "Envuelven la respuesta y fijan la cabecera de traza." "NestJS"
                filtro       = component "Filtro de excepciones" "Normaliza todo error al modelo único de la API." "NestJS"

                authM         = component "auth"             "Registro, inicio de sesión y rotación de tokens."
                usersM        = component "users"            "Cuentas y perfiles de paciente, terapeuta y administración."
                rbacM         = component "roles-permissions" "Fuente única del control de acceso."
                appointmentsM = component "appointments"     "Ciclo de vida de las citas."
                schedulingM   = component "scheduling"       "Disponibilidad y cálculo de huecos reservables."
                catalogM      = component "therapy-catalog"  "Productos terapéuticos y enfoques."
                contentM      = component "content"          "Publicaciones editoriales y acceso premium."
                advertisingM  = component "advertising"      "Campañas, creatividades y emplazamientos."
                cmsM          = component "cms"              "Páginas editables del sitio público."
                homepageM     = component "homepage"         "Composición de la portada."
                filesM        = component "files"            "Subida, firma y control de acceso de archivos."
                downloadablesM= component "downloadables"    "Recursos de pago y derechos de acceso."
                accountingM   = component "accounting"       "Partida doble, ventas y centros de coste."
                analyticsM    = component "analytics"        "Eventos de interfaz y visitas."
                auditM        = component "audit"            "Registro transversal de auditoría."
                messagingM    = component "messaging"        "Encolado de correo en el outbox."
                notificationsM= component "notifications"    "Avisos para el panel administrativo."
                healthM       = component "health"           "Sondas de vida y disponibilidad."
            }

            worker = container "Worker de outbox" "Proceso separado que entrega los mensajes encolados. Reintenta con retroceso exponencial." "Node 22"

            db    = container "PostgreSQL" "57 entidades. El esquema sólo cambia por migración." "PostgreSQL 16" "Almacén"
            redis = container "Redis" "Caché e invalidación por patrón. Prescindible." "Redis 7" "Almacén"

            docs = container "Referencia de la API" "Scalar sobre el contrato OpenAPI versionado. Desactivada en producción salvo activación explícita." "Scalar"
        }

        # --- Personas hacia el sistema
        paciente  -> api "Reserva citas y consulta contenido" "HTTPS/JSON"
        terapeuta -> api "Gestiona agenda y atiende citas"    "HTTPS/JSON"
        admin     -> api "Administra la plataforma"           "HTTPS/JSON"
        visitante -> api "Consulta el sitio público"          "HTTPS/JSON"
        admin     -> docs "Consulta y prueba la API"          "HTTPS"

        # --- Entrante desde terceros
        hotmart -> api "Notifica compras y reembolsos" "HTTPS + hottok"

        # --- Interior
        api -> db      "Lee y escribe"          "Sequelize / TCP 5432"
        api -> redis   "Cachea e invalida"      "ioredis / TCP 6379"
        api -> gcs     "Sube y firma archivos"  "SDK / HTTPS"
        api -> cloudinary "Sube y elimina archivos" "HTTPS"
        api -> otlp    "Exporta trazas"         "OTLP/HTTP"
        api -> docs    "Sirve el contrato"      "En proceso"

        worker -> db       "Toma lotes y marca resultados" "Sequelize / TCP 5432"
        worker -> sendgrid "Entrega el correo"             "SDK / HTTPS"
        worker -> otlp     "Exporta trazas"                "OTLP/HTTP"

        db -> neon "Copia programada" "pg_dump / HTTPS"

        # --- Componentes
        guards -> rbacM "Resuelve roles y permisos efectivos"
        authM -> rbacM "Consulta roles al emitir el token"
        authM -> messagingM "Encola el correo de restablecimiento"
        authM -> auditM "Registra intentos de acceso"
        usersM -> rbacM "Asigna y revoca roles"
        appointmentsM -> schedulingM "Comprueba disponibilidad antes de confirmar"
        appointmentsM -> messagingM "Encola confirmaciones"
        appointmentsM -> notificationsM "Avisa al panel administrativo"
        appointmentsM -> auditM "Registra cada transición de estado"
        homepageM -> contentM "Resuelve publicaciones destacadas"
        homepageM -> advertisingM "Resuelve anuncios por emplazamiento"
        downloadablesM -> notificationsM "Avisa de una concesión de acceso"
        contentM -> auditM "Registra publicación y despublicación"
        advertisingM -> auditM "Registra cambios de campaña"
        filesM -> auditM "Registra accesos a archivos"
        accountingM -> auditM "Registra movimientos"
        messagingM -> db "Persiste el mensaje en la misma transacción"
    }

    views {
        systemContext backend "Contexto" {
            include *
            autolayout lr
            description "Quién usa el backend y de qué depende."
        }

        container backend "Contenedores" {
            include *
            autolayout lr
            description "La API y el worker son procesos separados a propósito: el envío de correo no depende del servicio HTTP."
        }

        component api "ComponentesAPI" {
            include *
            autolayout lr
            description "Módulos de dominio y el pipeline transversal. audit no importa de ningún módulo de dominio: recibe aristas y no emite ninguna."
        }

        styles {
            element "Person"          { shape Person background #0b6e6e color #ffffff }
            element "Software System" { background #127c7c color #ffffff }
            element "Externo"         { background #8a8a8a color #ffffff }
            element "Container"       { background #1f9d9d color #ffffff }
            element "Almacén"         { shape Cylinder background #4a4a4a color #ffffff }
            element "Component"       { background #56c4c4 color #10312f }
        }
    }
}
