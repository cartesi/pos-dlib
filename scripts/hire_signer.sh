HOST="127.0.0.1"

ALICE_PORT="8546"
ALICE_ADDRESS=$(curl -X POST --data '{"jsonrpc":"2.0","method":"eth_accounts","params":[],"id":1}' http://${HOST}:${ALICE_PORT})

BOB_PORT="8547"
BOB_ADDRESS=$(curl -X POST --data '{"jsonrpc":"2.0","method":"eth_accounts","params":[],"id":1}' http://${HOST}:${BOB_PORT})


echo "${ALICE_ADDRESS}"
echo "${BOB_ADDRESS}"

echo "${ALICE_ADDRESS}" > scripts/alice_account.json
echo "${BOB_ADDRESS}" > scripts/bob_account.json
npx buidler run scripts/hire_signer.ts --network localhost
