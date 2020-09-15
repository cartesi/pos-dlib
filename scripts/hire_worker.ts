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

import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { WorkerAuthManager } from "../src/contracts/util/WorkerAuthManager";
import { WorkerManager } from "../src/contracts/util/WorkerManager";

import { WorkerManagerFactory } from "../src/contracts/util/WorkerManagerFactory";
import { WorkerAuthManagerFactory } from "../src/contracts/util/WorkerAuthManagerFactory";

const bre = require("@nomiclabs/buidler") as BuidlerRuntimeEnvironment;
const { deployments, ethers } = bre;

let userWM: WorkerManager;
let workerWM: WorkerManager;

let userWAM: WorkerAuthManager;

async function main() {
    const [worker, user] = await ethers.getSigners();
    const workerAddress = await worker.getAddress();

    const posAddress = (await deployments.get("PoS")).address;
    const wmAddress = (await deployments.get("WorkerManagerImpl")).address;
    const wamAddress = (await deployments.get("WorkerAuthManagerImpl")).address;

    workerWM = WorkerManagerFactory.connect(wmAddress, worker);
    userWM = WorkerManagerFactory.connect(wmAddress, user);

    userWAM = WorkerAuthManagerFactory.connect(wamAddress, user);

    // user hires worker
    const hire_transaction = await userWM.hire(workerAddress, {
        value: ethers.utils.parseEther("1")
    });
    console.log(`hire_transaction: ${hire_transaction.hash}`);

    // worker accepts job
    const accept_job = await workerWM.acceptJob();
    console.log(`accept_job: ${accept_job.hash}`);

    // user authorizes PoS dapp
    const authorize_transaction = await userWAM.authorize(
        workerAddress,
        posAddress
    );
    console.log(`authorize_transaction: ${authorize_transaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
