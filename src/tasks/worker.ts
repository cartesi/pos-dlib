// Copyright 2020 Cartesi Pte. Ltd.

// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { WorkerManagerAuthManagerImpl__factory } from "@cartesi/util";
import { task, types } from "hardhat/config";

task("worker:hire", "Hire and authorize a worker")
    .addOptionalParam(
        "accountIndex",
        "Account index from MNEMONIC to use",
        0,
        types.int
    )
    .addOptionalPositionalParam(
        "address",
        "Worker node address or account index from localhost provider",
        "0",
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { PoS, WorkerManagerAuthManagerImpl } = await deployments.all();
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const worker = WorkerManagerAuthManagerImpl__factory.connect(
            WorkerManagerAuthManagerImpl.address,
            signer
        );

        let workerAddress = args.address as string;
        if (!workerAddress.startsWith("0x")) {
            // get worker address from local node
            const localProvider = new ethers.providers.JsonRpcProvider(
                "http://localhost:8545"
            );
            const addresses = await localProvider.listAccounts();
            const index = parseInt(workerAddress);
            workerAddress = addresses[index];
        }

        console.log(
            `Hiring worker ${workerAddress} using account ${signer.address}`
        );
        // user hires worker
        const tx = await worker.hireAndAuthorize(workerAddress, PoS.address, {
            value: ethers.utils.parseEther("0.5"),
        });

        console.log(`transaction: ${tx.hash}`);
    });

task("worker:acceptJob", "Accept a job (FOR TESTING ONLY")
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
        const { WorkerManagerAuthManagerImpl } = await deployments.all();
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const worker = WorkerManagerAuthManagerImpl__factory.connect(
            WorkerManagerAuthManagerImpl.address,
            signer
        );

        console.log(`Accepting a job using account ${signer.address}`);

        // worker accepts a job
        const tx = await worker.acceptJob();
        console.log(`transaction: ${tx.hash}`);
    });

task("worker:authorize", "Authorize a worker")
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
        const { PoS, WorkerManagerAuthManagerImpl } = await deployments.all();
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const worker = WorkerManagerAuthManagerImpl__factory.connect(
            WorkerManagerAuthManagerImpl.address,
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
            `Authorizing PoS ${PoS.address} to accepts calls from worker ${workerAddress} on behalf of ${signer.address}`
        );
        // authorize PoS
        const tx = await worker.authorize(workerAddress, PoS.address);

        console.log(`transaction: ${tx.hash}`);
    });

task("worker:show", "Show a worker information")
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
        const { PoS, WorkerManagerAuthManagerImpl } = await deployments.all();
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const worker = WorkerManagerAuthManagerImpl__factory.connect(
            WorkerManagerAuthManagerImpl.address,
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

        const data = {
            worker: workerAddress,
            user: await worker.getUser(workerAddress),
            owner: await worker.getOwner(workerAddress),
            authorized: await worker.isAuthorized(workerAddress, PoS.address),
            available: await worker.isAvailable(workerAddress),
            owned: await worker.isOwned(workerAddress),
            pending: await worker.isPending(workerAddress),
            retired: await worker.isRetired(workerAddress),
        };
        console.log(data);
    });
