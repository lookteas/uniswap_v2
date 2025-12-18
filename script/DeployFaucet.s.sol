// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/Faucet.sol";

/**
 * @title DeployFaucet
 * @dev 部署 Faucet 水龙头合约
 * 
 * 使用方法:
 * forge script script/DeployFaucet.s.sol:DeployFaucet --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $PRIVATE_KEY
 */
contract DeployFaucet is Script {
    // Sepolia 测试网代币地址
    address constant TKA = 0x89349c29eAb08674Ccb243aEf113c28847fB5215;
    address constant TKB = 0x92e90F895172CDc96BB0985BC56f0cA4874aEd79;
    address constant TKC = 0x7Ca1a37CD0dE6f2bf06c09Da57bEa14344BfBa25;
    address constant TKD = 0x4dDCabc42aAF3403e300413F3b8AD909F58785b1;
    address constant TKE = 0xC47941810E359DB426f5c4a3487e3110172283c6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        console.log("");

        // 准备代币列表
        address[] memory tokens = new address[](5);
        tokens[0] = TKA;
        tokens[1] = TKB;
        tokens[2] = TKC;
        tokens[3] = TKD;
        tokens[4] = TKE;

        vm.startBroadcast(deployerPrivateKey);

        // 部署 Faucet 合约
        Faucet faucet = new Faucet(tokens);
        console.log("Faucet deployed at:", address(faucet));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("Faucet:", address(faucet));
        console.log("Tokens configured:", tokens.length);
        console.log("Claim amount: 1000 tokens per token");
        console.log("");
        console.log("Next steps:");
        console.log("1. Transfer tokens to the Faucet contract");
        console.log("2. Update frontend with Faucet address");
    }
}
