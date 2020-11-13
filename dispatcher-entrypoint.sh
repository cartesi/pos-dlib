#!/bin/sh

# exit when any command fails
set -e

echo "Waiting for external signer at http://${ETHEREUM_HOST}:${ETHEREUM_PORT}"
dockerize -wait tcp://${ETHEREUM_HOST}:${ETHEREUM_PORT} -timeout ${ETHEREUM_TIMEOUT}
export ACCOUNT_ADDRESS=$(curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_accounts","params":[],"id":1}' http://${ETHEREUM_HOST}:${ETHEREUM_PORT} | jq -r '.result[0]')

echo "Starting worker node with address ${ACCOUNT_ADDRESS}"
envsubst < /opt/cartesi/etc/pos/config-template.yaml > /opt/cartesi/etc/pos/config.yaml
/opt/cartesi/bin/pos --config_path /opt/cartesi/etc/pos/config.yaml --working_path /opt/cartesi/srv/pos
