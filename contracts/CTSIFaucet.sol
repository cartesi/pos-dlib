// Copyright (C) 2020 Cartesi Pte. Ltd.

// SPDX-License-Identifier: GPL-3.0-only
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

/// @title CTSIFaucet
/// @author Felipe Argento

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CTSIFaucet {
    IERC20 ctsi;

    uint256 AMOUNT = 100 * (10**18);

    /// @notice Creates contract
    /// @param _ctsi address of ERC20 token to be used
    constructor(address _ctsi) {
        ctsi = IERC20(_ctsi);
    }

    /// @notice Receives ether and sends CTSI back
    function drip() payable public {
        require(msg.value >= 0.3 ether, "Not enough ether sent in the transaction");
        ctsi.transfer(msg.sender, AMOUNT);
    }
}
