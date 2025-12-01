// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title DeployWETH
 * @notice 部署 WETH9 合约（仅用于本地测试）
 * @dev Sepolia 等测试网已有 WETH，无需部署
 */
contract DeployWETH is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying WETH9...");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        bytes memory bytecode = vm.getCode("WETH9.sol:WETH9");
        
        address weth;
        assembly {
            weth := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(weth != address(0), "WETH deployment failed");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("========================================");
        console.log("WETH9 deployed at:", weth);
        console.log("========================================");
        console.log("");
        console.log("Set this as WETH_ADDRESS for Router deployment:");
        console.log("$env:WETH_ADDRESS = \"", weth, "\"");
    }
}
