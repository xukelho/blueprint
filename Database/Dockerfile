# syntax=docker/dockerfile:1
FROM postgres:17.5-alpine

LABEL org.opencontainers.image.title="blueprint-database"

ENV POSTGRES_DB=blueprint
ENV POSTGRES_USER=blueprint
ENV POSTGRES_PASSWORD=blueprint_dev_password

EXPOSE 5432

VOLUME ["/var/lib/postgresql/data"]

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
    CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1
