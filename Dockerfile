FROM rust:1.44 as build

ENV BASE /opt/cartesi
RUN \
    apt-get update && \
    apt-get install --no-install-recommends -y cmake protobuf-compiler && \
    rm -rf /var/lib/apt/lists/*

WORKDIR $BASE/pos

# Compile dependencies
COPY ./pos/Cargo_cache.toml ./Cargo.toml
RUN mkdir -p ./src && echo "fn main() { }" > ./src/main.rs
RUN cargo build -j $(nproc) --release

WORKDIR $BASE
COPY ./dispatcher/ $BASE/dispatcher

WORKDIR $BASE/pos

# Compile pos
COPY ./pos/Cargo.toml ./
COPY ./pos/Cargo.lock ./
COPY ./pos/src ./src

RUN cargo install -j $(nproc) --path .

# Runtime image
FROM debian:buster-slim as runtime

ENV BASE /opt/cartesi

RUN \
    apt-get update && \
    apt-get install --no-install-recommends -y ca-certificates curl gettext jq wget && \
    rm -rf /var/lib/apt/lists/*

ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

WORKDIR /opt/cartesi

# Copy the build artifacts from the build stage
COPY --from=build /usr/local/cargo/bin/pos $BASE/bin/pos

# Copy onchain deployments and artifacts
COPY deployments $BASE/share/blockchain/deployments
COPY node_modules/@cartesi $BASE/share/blockchain/node_modules/@cartesi

# Copy dispatcher scripts
COPY ./dispatcher-entrypoint.sh $BASE/bin/
COPY ./config-template.yaml $BASE/etc/pos/
RUN mkdir -p $BASE/srv/pos

ENV ETHEREUM_HOST "localhost"
ENV ETHEREUM_PORT "8545"
ENV ETHEREUM_TIMEOUT "120s"

ENTRYPOINT $BASE/bin/dispatcher-entrypoint.sh
