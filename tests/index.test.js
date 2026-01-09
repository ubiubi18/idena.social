const path = require('path');
const fs = require('fs');

const {
    toHexString,
} = require('idena-sdk-js');

const {
    ContractRunnerProvider,
    ContractArgumentFormat,
} = require('idena-sdk-tests');

function str2hex(str) {
    return toHexString(Buffer.from(str));
}

function rmZeros(str) {
    return str.replaceAll(/[.0]+$/g, '');
}

const provider = ContractRunnerProvider.create('http://localhost:3333', '');

describe('idena.social.wasm', () => {
    let deployReceipt;
    let sender;

    beforeEach(async () => {
        const wasm = path.join('.', 'build', 'release', 'idena.social.wasm');

        const code = fs.readFileSync(wasm);

        await provider.Chain.generateBlocks(1);
        await provider.Chain.resetTo(2);

        const deployTx = await provider.Contract.deploy(
            '0',
            '9999',
            code,
            Buffer.from('')
        );
        await provider.Chain.generateBlocks(1);

        deployReceipt = await provider.Chain.receipt(deployTx);
    });

    describe('makePost', () => {
        it('should make a post', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'makePost',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({
                            channelId: 'general',
                            message: 'test message',
                            replyToPostId: 'testReplyId',
                            repostPostId: 'testRepostId',
                            displayImageLink: 'https://displayimagelink.notadomain',
                            mediaLink: 'https://medialink.notadomain',
                            mediaType: 'MP4',
                            tags: ['0x12345', '0x54321', '0x00001']
                        }),
                    },
                ]
            );
            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);

            expect(receipt.events.length).toBe(1);
            expect(receipt.events[0].event).toBe('makePost');
            expect(receipt.events[0].args.length).toBe(11);
            expect(receipt.events[0].args[0].startsWith('0x')).toBe(true);
            expect(receipt.events[0].args[0].length).toBe(42);
            expect(parseInt(rmZeros(receipt.events[0].args[1]), 16)).toBe(1);
            expect(receipt.events[0].args[2]).toBe(str2hex('general'));
            expect(receipt.events[0].args[3]).toBe(str2hex('test message'));
            expect(receipt.events[0].args[4]).toBe(str2hex('testReplyId'));
            expect(receipt.events[0].args[5]).toBe(str2hex('testRepostId'));
            expect(receipt.events[0].args[6]).toBe(str2hex('https://displayimagelink.notadomain'));
            expect(receipt.events[0].args[7]).toBe(str2hex('https://medialink.notadomain'));
            expect(receipt.events[0].args[8]).toBe(str2hex('MP4'));
            expect(receipt.events[0].args[9]).toBe(str2hex('0x12345,0x54321,0x00001'));
            expect(parseInt(receipt.events[0].args[10], 16)).toBe(0);

            // Setting the sender for all tests.
            sender = receipt.events[0].args[0];
            // Do not delete

            const posterHex = await provider.Contract.readMap(
                deployReceipt.contract,
                'p:',
                receipt.events[0].args[1],
                'string',
            );
            expect(posterHex.startsWith('0x')).toBe(true);
            expect(posterHex.length).toBe(42);

            const stateResult = await provider.Contract.readData(
                deployReceipt.contract,
                'STATE',
                'string',
            );
            const state = JSON.parse(stateResult);
            expect(parseInt(state.currentPostId)).toBe(1);

            const idenianDetailsResult = await provider.Contract.readMap(
                deployReceipt.contract,
                'i:',
                sender,
                'string',
            );
            const idenianDetails = JSON.parse(idenianDetailsResult);
            expect(idenianDetails.alias).toBe('');
            expect(parseInt(idenianDetails.tipsBalance)).toBe(0);
        });

        it('should burn the amount sent', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'makePost',
                '10',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ channelId: 'general', message: 'test message' }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);

            expect(parseInt(receipt.events[0].args[10], 16)).toBe(10e18);

            const balance = await provider.Chain.balance(deployReceipt.contract);
            expect(balance).toBe('0');
        });

        it('should error when message not supplied', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'makePost',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ channelId: 'general', message: '' }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('message not supplied')).toBe(true);
        });
    });

    describe('sendTip', () => {
        beforeEach(async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'makePost',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ channelId: 'general', message: 'test message' }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);
            await provider.Chain.receipt(tx);
        });


        it('should send tip to post', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendTip',
                '10',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: '1',
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);

            expect(receipt.events.length).toBe(1);
            expect(receipt.events[0].event).toBe('sendTip');
            expect(receipt.events[0].args.length).toBe(3);
            expect(receipt.events[0].args[0]).toBe(sender);
            expect(parseInt(rmZeros(receipt.events[0].args[1]), 16)).toBe(1);
            expect(parseInt(receipt.events[0].args[2], 16)).toBe(10e18);

            const posterHex = await provider.Contract.readMap(
                deployReceipt.contract,
                'p:',
                receipt.events[0].args[1],
                'string',
            );

            const idenianDetailsResult = await provider.Contract.readMap(
                deployReceipt.contract,
                'i:',
                posterHex,
                'string',
            );
            const idenianDetails = JSON.parse(idenianDetailsResult);
            expect(parseInt(idenianDetails.tipsBalance)).toBe(10e18);
        });

        it('should error when post does not exist', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendTip',
                '10',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: '2',
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('non-existent post')).toBe(true);
        });

        it('should error when tip not sent', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendTip',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: '1',
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('cannot tip nothing')).toBe(true);
        });
    });

    describe('sendTipFromBalance', () => {
        beforeEach(async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'makePost',
                '1',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ channelId: 'general', message: 'test message' }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);
            await provider.Chain.receipt(tx);

            const tx2 = await provider.Contract.call(
                deployReceipt.contract,
                'deposit',
                '10',
                '9999',
                []
            );

            await provider.Chain.generateBlocks(1);
            await provider.Chain.receipt(tx2);
        });

        it('should send a tip from balance', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendTipFromBalance',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ postId: '1', tipAmount: 10e18.toString() }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);

            expect(receipt.events.length).toBe(1);
            expect(receipt.events[0].event).toBe('sendTip');
            expect(receipt.events[0].args.length).toBe(3);
            expect(receipt.events[0].args[0]).toBe(sender);
            expect(parseInt(rmZeros(receipt.events[0].args[1]), 16)).toBe(1);
            expect(parseInt(receipt.events[0].args[2], 16)).toBe(10e18);

            const posterHex = await provider.Contract.readMap(
                deployReceipt.contract,
                'p:',
                receipt.events[0].args[1],
                'string',
            );

            const idenianDetailsResult = await provider.Contract.readMap(
                deployReceipt.contract,
                'i:',
                posterHex,
                'string',
            );
            const idenianDetails = JSON.parse(idenianDetailsResult);
            expect(parseInt(idenianDetails.tipsBalance)).toBe(10e18);
        });

        it('should send a small tip', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendTipFromBalance',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ postId: '1', tipAmount: (1).toString() }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);

            expect(parseInt(receipt.events[0].args[2], 16)).toBe(1);
        });

        it('should error when post does not exist', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendTipFromBalance',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ postId: '2', tipAmount: 10e18.toString() }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('non-existent post')).toBe(true);
        });

        it('should error when tip not specified', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendTipFromBalance',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ postId: '1', tipAmount: '0' }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('cannot tip nothing')).toBe(true);
        });

        it('should error when insufficient balance', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendTipFromBalance',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ postId: '1', tipAmount: 11e18.toString() }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('insufficient funds')).toBe(true);
        });
    });

    describe('deposit', () => {
        it('should deposit into balance', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'deposit',
                '10',
                '9999',
                []
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);
        });

        it('should error when nothing deposited', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'deposit',
                '0',
                '9999',
                []
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('cannot deposit nothing')).toBe(true);
        });
    });

    describe('withdraw', () => {
        beforeEach(async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'deposit',
                '10',
                '9999',
                []
            );

            await provider.Chain.generateBlocks(1);
            await provider.Chain.receipt(tx);
        });

        it('should withdraw from balance', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'withdraw',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.Dna,
                        value: '10'
                    }
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);
        });

        it('should error when zero withdraw amount supplied', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'withdraw',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.Dna,
                        value: '0'
                    }
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('cannot withdraw nothing')).toBe(true);
        });

        it('should error when insufficient funds for withdrawal', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'withdraw',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.Dna,
                        value: '11'
                    }
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('insufficient funds')).toBe(true);
        });
    });

    describe('updateAlias', () => {
        it('should update the sender alias', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'updateAlias',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: 'MyNameAlias',
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);

            expect(receipt.events.length).toBe(1);
            expect(receipt.events[0].event).toBe('updateAlias');
            expect(receipt.events[0].args.length).toBe(2);
            expect(receipt.events[0].args[0]).toBe(sender);
            expect(receipt.events[0].args[1]).toBe(str2hex('MyNameAlias'));
        });

        it('should error when alias not supplied', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'updateAlias',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: '',
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('alias not supplied')).toBe(true);
        });
    });

    describe('sendMessage', () => {
        it('should send message', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendMessage',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ recipient: '0x00001', channelId: 'general', message: 'test message', encrypted: false, replyToMessageTxId: '0x00002' }),
                    },
                ]
            );
            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);

            expect(receipt.events.length).toBe(1);
            expect(receipt.events[0].event).toBe('sendMessage');
            expect(receipt.events[0].args.length).toBe(7);
            expect(receipt.events[0].args[0]).toBe(sender);
            expect(receipt.events[0].args[1]).toBe(str2hex('0x00001'));
            expect(receipt.events[0].args[2]).toBe(str2hex('general'));
            expect(receipt.events[0].args[3]).toBe(str2hex('test message'));
            expect(receipt.events[0].args[4]).toBe(str2hex('false'));
            expect(receipt.events[0].args[5]).toBe(str2hex('0x00002'));
            expect(parseInt(receipt.events[0].args[6], 16)).toBe(0);
        });

        it('should burn the amount sent', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendMessage',
                '10',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ channelId: 'general', message: 'test message' }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(true);

            expect(parseInt(receipt.events[0].args[6], 16)).toBe(10e18);

            const balance = await provider.Chain.balance(deployReceipt.contract);
            expect(balance).toBe('0');
        });

        it('should error when message not supplied', async () => {
            const tx = await provider.Contract.call(
                deployReceipt.contract,
                'sendMessage',
                '0',
                '9999',
                [
                    {
                        index: 0,
                        format: ContractArgumentFormat.String,
                        value: JSON.stringify({ channelId: 'general', message: '' }),
                    },
                ]
            );

            await provider.Chain.generateBlocks(1);

            const receipt = await provider.Chain.receipt(tx);
            expect(receipt.success).toBe(false);
            expect(receipt.error.includes('message not supplied')).toBe(true);
        });
    });
});
