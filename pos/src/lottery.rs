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

use super::dispatcher::{Archive, DApp, Reaction};
use super::dispatcher::{U256Array6};
use super::error::Result;
use super::error::*;
use super::ethabi::Token;
use super::ethereum_types::{U256};
use super::transaction;
use super::transaction::TransactionRequest;

pub struct Lottery();

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// these two structs and the From trait below should be
// obtained from a simple derive
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
#[derive(Serialize, Deserialize)]
pub struct LotteryCtxParsed(
    pub U256Array6, //current block
    // currentGoalBlockNumber
    // difficulty
    // stakedBalance
    // timePassedMicroSeconds
    // logDrivePosition
    // logOfDistance
);

#[derive(Serialize, Debug)]
pub struct LotteryCtx {
    pub block_number: U256,
    pub goal_block_number: U256,
    pub difficulty: U256,
    pub staked_balance: U256,
    pub time_passed_micro_seconds: U256,
    pub log_of_distance: U256,
}

impl From<LotteryCtxParsed> for LotteryCtx {
    fn from(parsed: LotteryCtxParsed) -> LotteryCtx {
        LotteryCtx {
            block_number: parsed.0.value[0],
            goal_block_number: parsed.0.value[1],
            difficulty: parsed.0.value[2],
            staked_balance: parsed.0.value[3],
            time_passed_micro_seconds: parsed.0.value[4],
            log_of_distance: parsed.0.value[5],
        }
    }
}

impl DApp<()> for Lottery {
    /// React to the Lottery contract
    fn react(
        instance: &state::Instance,
        _archive: &Archive,
        _post_payload: &Option<String>,
        _param: &(),
    ) -> Result<Reaction> {
        // get context (state) of the lottery instance
        let parsed: LotteryCtxParsed =
            serde_json::from_str(&instance.json_data).chain_err(|| {
                format!(
                    "Could not parse lottery instance json_data: {}",
                    &instance.json_data
                )
            })?;
        let ctx: LotteryCtx = parsed.into();
        trace!(
            "Context for lottery (index {}) {:?}",
            instance.index,
            ctx
        );

        // if tournament is full and player hasnt played, idle
        let contest_expired = ctx.block_number.as_u64() - ctx.goal_block_number.as_u64() > 220;
        let eligible_to_win = ctx.staked_balance * ctx.time_passed_micro_seconds > ctx.difficulty * (256000000 - ctx.log_of_distance.as_u64());

        if contest_expired || eligible_to_win {
            info!("Claiming victory for lottery (index: {})", instance.index);
            let request = TransactionRequest {
                concern: instance.concern.clone(),
                value: U256::from(0),
                function: "claimRound".into(),
                data: vec![Token::Uint(instance.index)],
                gas: None,
                strategy: transaction::Strategy::Simplest,
                contract_name: None, // Name not needed, is concern
            };
            return Ok(Reaction::Transaction(request));
        } else {
            //return idle
            return Ok(Reaction::Idle);
        }
    }

    fn get_pretty_instance(
        instance: &state::Instance,
        archive: &Archive,
        _param: &(),
    ) -> Result<state::Instance> {
        // get context (state) of the lottery instance
        let parsed: LotteryCtxParsed =
            serde_json::from_str(&instance.json_data).chain_err(|| {
                format!(
                    "Could not parse lottery instance json_data: {}",
                    &instance.json_data
                )
            })?;
        let ctx: LotteryCtx = parsed.into();
        let json_data = serde_json::to_string(&ctx).unwrap();

        let pretty_sub_instances: Vec<Box<state::Instance>> = vec![];

        let pretty_instance = state::Instance {
            name: "Lottery".to_string(),
            concern: instance.concern.clone(),
            index: instance.index,
            service_status: archive.get_service("Lottery".into()),
            json_data: json_data,
            sub_instances: pretty_sub_instances,
        };

        return Ok(pretty_instance);
    }
}
