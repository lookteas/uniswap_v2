// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title DeployFactory
 * @notice 单独部署 UniswapV2Factory 的脚本
 */
contract DeployFactory is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying UniswapV2Factory...");
        console.log("Deployer:", deployer);
        console.log("FeeToSetter:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署 Factory
        bytes memory bytecode = vm.getCode("v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory");
        bytes memory args = abi.encode(deployer);
        bytes memory creationCode = abi.encodePacked(bytecode, args);
        
        address factory;
        assembly {
            factory := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(factory != address(0), "Factory deployment failed");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("========================================");
        console.log("UniswapV2Factory deployed at:", factory);
        console.log("========================================");
        
        // 计算并输出 init code hash
        bytes memory pairBytecode = vm.getCode("v2-core/contracts/UniswapV2Pair.sol:UniswapV2Pair");
        bytes32 initCodeHash = keccak256(pairBytecode);
        console.log("");
        console.log("Pair Init Code Hash:");
        console.logBytes32(initCodeHash);
        console.log("");
        console.log("Save this hash! You may need to update");
        console.log("UniswapV2Library.sol if it differs from the default.");
    }
}
