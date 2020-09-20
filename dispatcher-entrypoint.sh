#!/bin/sh

# exit when any command fails
set -e

if [ -n "${CONCERN_SEMAPHORE}" ]; then
    # wait for key file and read from them
    echo "Waiting for key signal at ${CONCERN_SEMAPHORE}"
    dockerize -wait ${CONCERN_SEMAPHORE} -timeout ${ETHEREUM_TIMEOUT}

    if [[ -f "/opt/cartesi/etc/keys/private_key" ]]; then
        export CARTESI_CONCERN_KEY=$(cat /opt/cartesi/etc/keys/private_key)
    fi

    if [[ -f "/opt/cartesi/etc/keys/account" ]]; then
        export ACCOUNT_ADDRESS=$(cat /opt/cartesi/etc/keys/account)
    fi

elif [ -n "${MNEMONIC}" ]; then
    echo "Initializing key and account from MNEMONIC"
    export CARTESI_CONCERN_KEY=$(wagyu ethereum import-hd --mnemonic "${MNEMONIC}" --derivation "m/44'/60'/0'/0/${ACCOUNT_INDEX}" --json | jq -r '.[0].private_key')
    export ACCOUNT_ADDRESS=$(wagyu ethereum import-hd --mnemonic "${MNEMONIC}" --derivation "m/44'/60'/0'/0/${ACCOUNT_INDEX}" --json | jq -r '.[0].address')
fi

# wait for deployment if env is set
if [ -n "${DEPLOYMENT_SEMAPHORE}" ]; then
    echo "Waiting for blockchain deployment..."
    dockerize -wait ${DEPLOYMENT_SEMAPHORE} -timeout ${ETHEREUM_TIMEOUT}
fi

echo "Waiting for services..."
dockerize -wait tcp://${ETHEREUM_HOST}:${ETHEREUM_PORT} -timeout ${ETHEREUM_TIMEOUT}

if [ -z "${CONCERN_SEMAPHORE}" ] && [ -z "${MNEMONIC}" ]; then
    if [ -z "${ACCOUNT_ADDRESS}" ]; then
        echo "No mnemonic or file set, using external signer at http://${ETHEREUM_HOST}:${ETHEREUM_PORT}"
        export ACCOUNT_ADDRESS=$(curl -X POST --data '{"jsonrpc":"2.0","method":"eth_accounts","params":[],"id":1}' http://${ETHEREUM_HOST}:${ETHEREUM_PORT} | jq -r '.result[0]')
    else
        echo "Account address defined in ENV"
    fi
fi

echo "Creating configuration file at /opt/cartesi/etc/pos/config.yaml with account ${ACCOUNT_ADDRESS}"
envsubst < /opt/cartesi/etc/pos/config-template.yaml > /opt/cartesi/etc/pos/config.yaml
cat /opt/cartesi/etc/pos/config.yaml

echo "Starting dispatcher"
/opt/cartesi/bin/pos --config_path /opt/cartesi/etc/pos/config.yaml --working_path /opt/cartesi/srv/pos
