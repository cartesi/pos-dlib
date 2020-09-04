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

export default async (
    bre: BuidlerRuntimeEnvironment,
    deployer: string,
    contract: any
): Promise<string> => {
    const { deployments, getChainId } = bre;
    const { deploy } = deployments;
    const network_id = await getChainId();

    if (contract.networks && contract.networks[network_id]) {
        return Promise.resolve(contract.networks[network_id].address);
    } else {
        const { contractName } = contract;
        console.log(
            `${contractName} not deployed at network ${network_id}. Deploying...`
        );
        return deploy(contractName, {
            from: deployer,
            contract,
            log: true
        }).then(result => result.address);
    }
};
