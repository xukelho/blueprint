# syntax=docker/dockerfile:1
FROM postgres:17.5-alpine

LABEL org.opencontainers.image.title="blueprint-database"

# Keep the project database on its explicitly assigned internal port.
EXPOSE 7584

VOLUME ["/var/lib/postgresql/data"]

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
    CMD pg_isready -p 7584 -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1

CMD ["postgres", "-c", "port=7584"]
