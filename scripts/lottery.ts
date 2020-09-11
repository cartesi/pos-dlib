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
import { program } from "commander";
import { Lottery } from "../src/contracts/pos/Lottery";

const bre = require("@nomiclabs/buidler") as BuidlerRuntimeEnvironment;
const { deployments, ethers } = bre;

async function main() {
    const { Lottery, PoS } = await deployments.all();

    const drawInterval = program.drawInterval;
    const diffAdjustment = program.diffAdjustment;

    const lottery = (await ethers.getContractAt(
        "Lottery",
        Lottery.address
    )) as Lottery;

    const transaction = await lottery.instantiate(
        diffAdjustment,
        drawInterval,
        PoS.address
    );
    console.log(`Lottery created: ${transaction.hash}`);
}

program
    .option(
        "-da, --diff-adjustment <adjustment>",
        "Specify the difficult adjustment parameter",
        parseFloat,
        200
    )
    .option(
        "-di, --draw-interval <duration>",
        "Specify the desired duration of each draw, in seconds",
        parseFloat,
        100
    );

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
