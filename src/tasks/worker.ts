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
import { WorkerManagerAuthManagerImplFactory } from "@cartesi/util";
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
        "Worker node address",
        undefined,
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { PoS, WorkerManagerAuthManagerImpl } = await deployments.all();
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const worker = WorkerManagerAuthManagerImplFactory.connect(
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
            `Hiring worker ${workerAddress} using account ${signer.address}`
        );
        // user hires worker
        const tx = await worker.hireAndAuthorize(workerAddress, PoS.address, {
            value: ethers.utils.parseEther("0.5"),
        });

        console.log(`transaction: ${tx.hash}`);
    });
