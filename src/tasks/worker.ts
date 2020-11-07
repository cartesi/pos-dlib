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

import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import {
    WorkerManagerImplFactory,
    WorkerAuthManagerImplFactory,
} from "@cartesi/util";
import { task, types } from "hardhat/config";

task("worker:hire", "Hire a worker")
    .addOptionalParam(
        "accountIndex",
        "Account index from MNEMONIC to use",
        0,
        types.int
    )
    .addOptionalPositionalParam(
        "address",
        "Worker node address",
        undefined,
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { WorkerManagerImpl } = await deployments.all();
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const worker = await WorkerManagerImplFactory.connect(
            WorkerManagerImpl.address,
            signer
        );

        let workerAddress = args.address;
        if (!workerAddress) {
            // get worker address from local node
            const localProvider = new ethers.providers.JsonRpcProvider(
                "http://localhost:8545"
            );
            const addresses = await localProvider.listAccounts();
            workerAddress = addresses[0];
        }

        console.log(
            `Hiring worker ${workerAddress} using account ${signer.address}`
        );
        // user hires worker
        const hire_transaction = await worker.hire(workerAddress, {
            value: ethers.utils.parseEther("1"),
        });

        console.log(`hire_transaction: ${hire_transaction.hash}`);
    });

task("worker:auth", "Authorize PoS to be called by a worker")
    .addOptionalParam(
        "accountIndex",
        "Account index from MNEMONIC to use",
        0,
        types.int
    )
    .addOptionalPositionalParam(
        "address",
        "Worker node address",
        undefined,
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const { PoS, WorkerAuthManagerImpl } = await deployments.all();

        const authManager = WorkerAuthManagerImplFactory.connect(
            WorkerAuthManagerImpl.address,
            signer
        );

        let workerAddress = args.address;
        if (!workerAddress) {
            // get worker address from local node
            const localProvider = new ethers.providers.JsonRpcProvider(
                "http://localhost:8545"
            );
            const addresses = await localProvider.listAccounts();
            workerAddress = addresses[0];
        }

        // user authorizes PoS dapp
        console.log(
            `Authorizing ${
                PoS.address
            } to accept calls from ${workerAddress} on behalf of ${await signer.getAddress()}`
        );
        const authorize_transaction = await authManager.authorize(
            workerAddress,
            PoS.address
        );
        console.log(`authorize_transaction: ${authorize_transaction.hash}`);
    });
