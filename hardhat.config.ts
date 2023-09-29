// Copyright (C) 2020 Cartesi Pte. Ltd.

// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version.

// This program is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
// PARTICULAR PURPOSE. See the GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Note: This component currently has dependencies that are licensed under the GNU
// GPL, version 3, and so you should treat this component as a whole as being under
// the GPL version 3. But all Cartesi-written code in this component is licensed
// under the Apache License, version 2, or a compatible permissive license, and can
// be used independently under the Apache v2 license. After this component is
// rewritten, the entire component will be released under the Apache v2 license.

import { HardhatUserConfig } from "hardhat/config";
import { HttpNetworkUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "solidity-coverage";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "./src/tasks";

// read MNEMONIC from env variable
let mnemonic = process.env.MNEMONIC;

const infuraNetwork = (
    network: string,
    chainId?: number,
    gas?: number
): HttpNetworkUserConfig => {
    return {
        url: `https://${network}.infura.io/v3/${process.env.PROJECT_ID}`,
        chainId,
        gas,
        accounts: mnemonic ? { mnemonic } : undefined,
    };
};

const config: HardhatUserConfig = {
    networks: {
        hardhat: mnemonic
            ? { accounts: { mnemonic, count: 400 } }
            : { accounts: { count: 400 } },
        localhost: {
            url: "http://localhost:8545",
            accounts: mnemonic ? { mnemonic, count: 400 } : undefined,
        },
        mainnet: infuraNetwork("mainnet", 1, 6283185),
        goerli: infuraNetwork("goerli", 5, 6283185),
    },
    solidity: {
        compilers: [
            {
                version: "0.7.4",
                settings: {
                    optimizer: {
                        enabled: true,
                    },
                },
            },
            {
                version: "0.8.14",
                settings: {
                    optimizer: {
                        enabled: true,
                    },
                },
            },
        ],
    },
    paths: {
        artifacts: "artifacts",
        deploy: "deploy",
        deployments: "deployments",
    },
    external: {
        contracts: [
            {
                artifacts: "node_modules/@cartesi/token/export/artifacts",
                deploy: "node_modules/@cartesi/token/dist/deploy",
            },
            {
                artifacts: "node_modules/@cartesi/util/export/artifacts",
                deploy: "node_modules/@cartesi/util/dist/deploy",
            },
            {
                artifacts: "node_modules/@cartesi/tree/export/artifacts",
                deploy: "node_modules/@cartesi/tree/dist/deploy",
            },
        ],
        deployments: {
            localhost: [
                "node_modules/@cartesi/util/deployments/localhost",
                "node_modules/@cartesi/tree/deployments/localhost",
                "node_modules/@cartesi/token/deployments/localhost",
            ],
            mainnet: [
                "node_modules/@cartesi/util/deployments/mainnet",
                "node_modules/@cartesi/tree/deployments/mainnet",
                "node_modules/@cartesi/token/deployments/mainnet",
            ],
            goerli: [
                "node_modules/@cartesi/util/deployments/goerli",
                "node_modules/@cartesi/tree/deployments/goerli",
                "node_modules/@cartesi/token/deployments/goerli",
            ],
        },
    },
    typechain: {
        outDir: "src/types",
        target: "ethers-v5",
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        alice: {
            default: 0,
        },
        bob: {
            default: 1,
        },
        beneficiary: {
            default: 1,
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    mocha: {
        timeout: 120000,
    },
};

export default config;
