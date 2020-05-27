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
pragma solidity ^0.5.0;

contract Staking {
    uint256 constant TIME_TO_STAKE = 5 days;
    uint256 constant TIME_TO_WITHDRAW = 5 days;

    mapping(address => uint256) internal stakedBalance;
    mapping(address => StakeStruct) internal toBeStakedList;
    mapping(address => StakeStruct) internal toWithdrawList;
    mapping(address => uint256) internal withdrawBalance;
    mapping(address => ieoStruct) internal ieoFrozenFunds;

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

    function startStake(uint256 _amount) public {
        toBeStakedList[msg.sender].amount.push(_amount);
        toBeStakedList[msg.sender].date.push(now);
        toBeStakedList[msg.sender].count++;
    }

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

    function startWithdraw(uint256 _amount) public {
        toWithdrawList[msg.sender].amount.push(_amount);
        toWithdrawList[msg.sender].date.push(now);
        toWithdrawList[msg.sender].count++;
    }

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
