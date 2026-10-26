# 숲속대전 온라인 서버 이미지. Go 버전은 go.mod와 같게 맞춘다.
FROM golang:1.27.3-alpine@sha256:b8c9b82affbbb82a020bbcf998dad2ba9516944ac7e883524642a481a9505e9c AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/forest-clash-server .

FROM alpine:3.22@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f
# 승패 기록은 /data 폴더에 쓴다. 이 폴더를 서버의 폴더에 연결해 컨테이너를 지워도 기록이 남게 한다.
RUN addgroup -S -g 10001 forestclash \
  && adduser -S -u 10001 -G forestclash forestclash \
  && mkdir /data \
  && chown forestclash:forestclash /data
COPY --from=build /out/forest-clash-server /usr/local/bin/forest-clash-server
USER 10001:10001
ENV PORT=58970 DATA_FILE=/data/forest-clash-data.json
EXPOSE 58970
VOLUME /data
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD ["sh", "-c", "wget -qO- \"http://127.0.0.1:${PORT}/healthz\" || exit 1"]
ENTRYPOINT ["forest-clash-server"]
