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


/// @title Cartesi Staking
/// @author Felipe Argento
pragma solidity ^0.5.0;

contract Staking {
    uint256 constant TIME_TO_STAKE = 5 days;
    uint256 constant TIME_TO_WITHDRAW = 5 days;

    mapping(address => uint256) internal stakedBalance; // the amount of money currently being staked.
    mapping(address => StakeStruct) internal toBeStakedList; // stakes that are waiting to be old enough to become staked.
    mapping(address => StakeStruct) internal toWithdrawList; // money that is waiting to be withdrew.
    mapping(address => ieoStruct) internal ieoFrozenFunds; // funds that were frozen during token launch, they will count as stake.

    struct ieoStruct {
        uint256 balance; // the amount of money that was locked during token creation
        uint256 releaseDate; // when those tokens are to be released
    }

    struct StakeStruct {
        uint256[] amount;
        uint256[] date;
        uint256 count;
        uint256 lastSearchIndex;
    }

    /// @notice Deposit CTSI to be staked. The money will turn into staked balance after TIME_TO_STAKE days, if the function finalizeStakes is called.
    /// @param _amount The amount of tokens that are gonna be deposited.
    function depositStake(uint256 _amount) public {
        toBeStakedList[msg.sender].amount.push(_amount);
        toBeStakedList[msg.sender].date.push(now);
        toBeStakedList[msg.sender].count++;
    }

    /// @notice Finalizes Stakes. Goes through the list toBeStaked and transform that into staked balance, if the requirements are met.
    /// @dev The number of stakes finalized is limited to 50 in order to avoid a deadlock in the contract - when the list is big enough so that the iteration doesnt fit the gas limit.
    function finalizeStakes() public {
        StakeStruct memory TBSL = toBeStakedList[msg.sender];

        for (uint256 i = TBSL.lastSearchIndex; (i < TBSL.count) || (i > TBSL.lastSearchIndex + 50); i++){
            if (now > TBSL.date[i] + TIME_TO_STAKE) {
                stakedBalance[msg.sender] += TBSL.amount[i];

                toBeStakedList[msg.sender].lastSearchIndex = i;
                delete toBeStakedList[msg.sender].amount[i];
                delete toBeStakedList[msg.sender].date[i];
            }

        }
    }

    /// @notice Start CTSI withdraw from staked balance process. The money will turn into withdrawal balance after TIME_TO_WITHDRAW days, if the function finalizeWithdraw is called.
    /// @param _amount The amount of tokens that are gonna be withdrew.
    function startWithdraw(uint256 _amount) public {
        toWithdrawList[msg.sender].amount.push(_amount);
        toWithdrawList[msg.sender].date.push(now);
        toWithdrawList[msg.sender].count++;
    }

    /// @notice Finalizes withdraws. Goes through the list toWithdraw and removes that from staked balance, if the requirements are met.
    /// @dev The number of withdraws finalized is limited to 50 in order to avoid a deadlock in the contract - when the list is big enough so that the iteration doesnt fit the gas limit.
    function finalizeWithdraws() public {
        StakeStruct memory TBWL = toWithdrawList[msg.sender];

        for (uint256 i = TBWL.lastSearchIndex; (i < TBWL.count) || (i > TBWL.lastSearchIndex + 50); i++){
            if (now > TBWL.date[i] + TIME_TO_WITHDRAW) {
                stakedBalance[msg.sender] -= TBWL.amount[i];

                toWithdrawList[msg.sender].lastSearchIndex = i;
                delete toWithdrawList[msg.sender].amount[i];
                delete toWithdrawList[msg.sender].date[i];
            }
        }
    }

}
