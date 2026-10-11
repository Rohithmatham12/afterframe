FROM golang:1.26.4-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /api ./cmd/api && CGO_ENABLED=0 go build -trimpath -o /migrate ./cmd/migrate
FROM alpine:3.22
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 afterframe
WORKDIR /app
COPY --from=build /api /migrate ./
COPY migrations ./migrations
USER afterframe
EXPOSE 8080
CMD ["./api"]
