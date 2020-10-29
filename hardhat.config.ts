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

import { HardhatUserConfig, task } from "hardhat/config";
import { HttpNetworkUserConfig } from "hardhat/types";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "hardhat-typechain";
import "hardhat-deploy";
import "hardhat-deploy-ethers";

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
        accounts: mnemonic ? { mnemonic } : undefined
    };
};

const config: HardhatUserConfig = {
    networks: {
        hardhat: mnemonic ? { accounts: { mnemonic } } : {},
        localhost: {
            url: "http://localhost:8545",
            accounts: mnemonic ? { mnemonic } : undefined
        },
        ropsten: infuraNetwork("ropsten", 3, 3283185),
        rinkeby: infuraNetwork("rinkeby", 4, 6283185),
        kovan: infuraNetwork("kovan", 42, 6283185),
        goerli: infuraNetwork("goerli", 5, 6283185),
        matic_testnet: {
            url: "https://rpc-mumbai.matic.today",
            chainId: 80001,
            accounts: mnemonic ? { mnemonic } : undefined
        },
        bsc_testnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545",
            chainId: 97,
            accounts: mnemonic ? { mnemonic } : undefined
        }
    },
    solidity: {
        version: "0.7.4",
        settings: {
            optimizer: {
                enabled: true
            }
        }
    },
    paths: {
        artifacts: "artifacts",
        deploy: "deploy",
        deployments: "deployments"
    },
    external: {
        artifacts: [
            "node_modules/@cartesi/util/artifacts",
            "node_modules/@cartesi/token/artifacts"
        ],
        deployments: {
            localhost: [
                "node_modules/@cartesi/util/deployments/localhost",
                "node_modules/@cartesi/token/deployments/localhost"
            ],
            ropsten: [
                "node_modules/@cartesi/util/deployments/ropsten",
                "node_modules/@cartesi/token/deployments/ropsten"
            ],
            rinkeby: [
                "node_modules/@cartesi/util/deployments/rinkeby",
                "node_modules/@cartesi/token/deployments/rinkeby"
            ],
            kovan: [
                "node_modules/@cartesi/util/deployments/kovan",
                "node_modules/@cartesi/token/deployments/kovan"
            ],
            goerli: [
                "node_modules/@cartesi/util/deployments/goerli",
                "node_modules/@cartesi/token/deployments/goerli"
            ],
            matic_testnet: [
                "node_modules/@cartesi/util/deployments/matic_testnet",
                "node_modules/@cartesi/token/deployments/matic_testnet"
            ],
            bsc_testnet: [
                "node_modules/@cartesi/util/deployments/bsc_testnet",
                "node_modules/@cartesi/token/deployments/bsc_testnet"
            ]
        }
    },
    typechain: {
        outDir: "src/types",
        target: "ethers-v5",
    },
    namedAccounts: {
        deployer: {
            default: 0
        },
        alice: {
            default: 0
        },
        bob: {
            default: 1
        }
    }
};

export default config;
