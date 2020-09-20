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


// import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { WorkerManager } from "@cartesi/util/src/types/WorkerManager";
import { WorkerManagerFactory } from "@cartesi/util/src/types/WorkerManagerFactory";

import { deployments, ethers } from "@nomiclabs/buidler";

// const bre = require("@nomiclabs/buidler");
// const { deployments, ethers } = bre;

async function main(aliceWorker: string, bobWorker: string) {
    const [alice, bob] = await ethers.getSigners();
    const wmAddress = (await deployments.get("WorkerManagerImpl")).address;

    const give_eth_transaction_alice = await alice.sendTransaction({
        to: aliceWorker,
        value: ethers.utils.parseEther("5")
    })
    console.log(`give_eth_transaction_alice: ${give_eth_transaction_alice.hash}`);

    const give_eth_transaction_bob = await bob.sendTransaction({
        to: bobWorker,
        value: ethers.utils.parseEther("5")
    })
    console.log(`give_eth_transaction_bob: ${give_eth_transaction_bob.hash}`);

    // user hires worker
    let aliceWM: WorkerManager = WorkerManagerFactory.connect(wmAddress, alice);
    const hire_transaction_alice = await aliceWM.hire(aliceWorker, {
        value: ethers.utils.parseEther("1")
    });
    console.log(`hire_transaction_alice: ${hire_transaction_alice.hash}`);


  // user hires worker
    let bobWM: WorkerManager = WorkerManagerFactory.connect(wmAddress, bob);
    const hire_transaction_bob = await bobWM.hire(bobWorker, {
        value: ethers.utils.parseEther("1")
    });
    console.log(`hire_transaction_bob: ${hire_transaction_bob.hash}`);
}

const alice_obj = require('./alice_account.json')
const bob_obj = require('./bob_account.json')
const aliceWorker = alice_obj.result[0]
const bobWorker = bob_obj.result[0]
console.log(`Alice worker address: ${aliceWorker}`);
console.log(`Bob worker address: ${bobWorker}`);

main(aliceWorker, bobWorker)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
