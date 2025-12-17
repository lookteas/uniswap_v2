// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/TestToken.sol";

/**
 * @title DeployTokens
 * @dev 部署 4 个测试代币 (TKA, TKB, TKC, TKD)
 * 
 * 使用方法:
 * forge script script/DeployTokens.s.sol:DeployTokens --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $PRIVATE_KEY
 */
contract DeployTokens is Script {
    // 每个代币的初始供应量: 1,000,000 tokens
    uint256 constant INITIAL_SUPPLY = 1_000_000 * 10**18;
    
    // 最大供应量: 0 表示无上限
    uint256 constant MAX_SUPPLY = 0;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer address:", deployer);
        console.log("Initial supply per token:", INITIAL_SUPPLY / 10**18, "tokens");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 部署 TKA
        TestToken tokenA = new TestToken("Token A", "TKA", INITIAL_SUPPLY, MAX_SUPPLY);
        console.log("TKA deployed at:", address(tokenA));

        // 部署 TKB
        TestToken tokenB = new TestToken("Token B", "TKB", INITIAL_SUPPLY, MAX_SUPPLY);
        console.log("TKB deployed at:", address(tokenB));

        // 部署 TKC
        TestToken tokenC = new TestToken("Token C", "TKC", INITIAL_SUPPLY, MAX_SUPPLY);
        console.log("TKC deployed at:", address(tokenC));

        // 部署 TKD
        TestToken tokenD = new TestToken("Token D", "TKD", INITIAL_SUPPLY, MAX_SUPPLY);
        console.log("TKD deployed at:", address(tokenD));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("TKA:", address(tokenA));
        console.log("TKB:", address(tokenB));
        console.log("TKC:", address(tokenC));
        console.log("TKD:", address(tokenD));
        console.log("");
        console.log("All tokens support ERC-2612 Permit!");
    }
}
