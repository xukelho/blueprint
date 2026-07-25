# syntax=docker/dockerfile:1

# Build from the Backend directory:
#   docker build -t blueprint-api ./Backend
#
# If this directory later contains more than one project, specify the API project:
#   docker build --build-arg PROJECT=src/Blueprint.Api/Blueprint.Api.csproj -t blueprint-api ./Backend
ARG DOTNET_VERSION=10.0

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS build
WORKDIR /src

# Set PROJECT to the path of the API .csproj (relative to the build context) when
# the build context contains multiple projects. A single project is discovered
# automatically.
ARG PROJECT=
COPY . .

RUN set -eu; \
    if [ -z "$PROJECT" ]; then \
        set -- $(find . -type f -name '*.csproj' -print); \
        [ "$#" -eq 1 ] || { echo 'Expected exactly one .csproj; set --build-arg PROJECT=<path-to-api.csproj>.' >&2; exit 1; }; \
        PROJECT="$1"; \
    fi; \
    test -f "$PROJECT"; \
    dotnet restore "$PROJECT"; \
    dotnet publish "$PROJECT" --configuration Release --no-restore --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS final
WORKDIR /app

# ASP.NET Core listens on port 1818 by default in .NET 8+ container images.
ENV ASPNETCORE_URLS=http://+:1818 \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

EXPOSE 1818

COPY --from=build /app/publish .

# The runtime configuration identifies the API assembly without requiring its
# name to be duplicated in this Dockerfile.
ENTRYPOINT ["sh", "-c", "runtimeconfig=$(find /app -maxdepth 1 -type f -name '*.runtimeconfig.json' -print -quit); test -n \"$runtimeconfig\"; exec dotnet \"${runtimeconfig%.runtimeconfig.json}.dll\""]
