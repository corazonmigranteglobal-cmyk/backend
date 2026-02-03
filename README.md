# Corazón Migrante – Backend

Este repositorio contiene el **backend oficial de la plataforma Corazón Migrante**. El backend es responsable de la lógica de negocio, la gestión de datos, la seguridad, la comunicación con servicios externos y la exposición de APIs que consumen el frontend y otros clientes.

El sistema está diseñado con un enfoque **modular, escalable y orientado a servicios**, priorizando claridad arquitectónica, separación de responsabilidades y mantenibilidad a largo plazo.

---

## 🧱 Tecnologías utilizadas

- **Node.js** – Entorno de ejecución principal
- **Express** – Framework para la creación de APIs HTTP
- **PostgreSQL** – Base de datos relacional
- **Redis** – Cache y cola de mensajes
- **Docker** – Contenerización del entorno
- **JavaScript (CommonJS / ESM)** – Lógica de aplicación

---

## 📁 Estructura del proyecto

```text
src/
├── controllers/        # Controladores HTTP (entrada de requests)
├── routes/             # Definición de rutas y endpoints
├── services/           # Lógica de negocio
├── repository/         # Acceso a datos y llamadas a funciones DB
├── core/               # Núcleo compartido (db, auth, cache, email, http)
│   ├── auth/           # Autenticación y JWT
│   ├── cache/          # Redis y colas
│   ├── db/             # Abstracción de base de datos
│   ├── email/          # Envío de correos
│   └── http/           # Middlewares y manejo de errores
├── config/             # Configuración general
└── index.js             # Punto de entrada del servidor
```

Otras carpetas relevantes:

```text
DB/                     # Scripts SQL, funciones y estructuras de respuesta
logs/                   # Logs de aplicación (no versionados)
test_module/            # Pruebas y scripts de test
```

Archivos principales en la raíz:
- `Dockerfile`
- `package.json`
- `package-lock.json`
- `.dockerignore`
- `.gitignore`
- `.env.example`
- `worker.js`

---

## ▶️ Ejecución en entorno de desarrollo

1. Instalar dependencias:
```bash
npm install
```

2. Levantar el servidor:
```bash
npm run dev
```

El backend se expondrá en el puerto configurado en las variables de entorno.

---

## 🐳 Ejecución con Docker

Para levantar el backend utilizando Docker:

```bash
docker build -t corazon-migrante-backend .
docker run -p 3000:3000 corazon-migrante-backend
```

Si se utiliza `docker-compose`, asegúrate de que los servicios dependientes (PostgreSQL, Redis) estén correctamente configurados.

---

## 🔐 Variables de entorno

Las variables de entorno **no se suben al repositorio**. El proyecto utiliza un archivo de ejemplo:

```text
.env.example
```

Este archivo debe copiarse y completarse localmente como `.env`.

---

## 🧠 Enfoque arquitectónico

El backend sigue un enfoque basado en capas:

- **Routes**: definición de endpoints
- **Controllers**: validación y orquestación de requests
- **Services**: reglas de negocio
- **Repository**: interacción con base de datos

La base de datos se gestiona principalmente mediante **funciones SQL** y estructuras de respuesta bien definidas, manteniendo el código JavaScript libre de SQL embebido.

---

## 📌 Notas finales

Este backend está diseñado para integrarse directamente con el frontend del proyecto Corazón Migrante y con futuros servicios adicionales. Cualquier cambio debe respetar la arquitectura y las convenciones establecidas para garantizar coherencia y estabilidad del sistema.
