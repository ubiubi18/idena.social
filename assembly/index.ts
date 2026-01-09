import {
    Address,
    BASE_IDNA,
    Bytes,
    Context,
    Host, 
    Balance,
    PersistentMap,
    util,
    u128,
} from 'idena-sdk-as';

class IdenianDetails {
    alias: string;
    tipsBalance: Balance;

    constructor() {
        this.alias = '';
        this.tipsBalance = Balance.Zero;
    }

    @mutateState
    updateAlias(alias: string): void {
        this.alias = alias;
    }

    @mutateState
    addTipsBalance(tip: Balance): void {
        this.tipsBalance = Balance.add(this.tipsBalance, tip);
    }

    @mutateState
    subtractTipsBalance(tip: Balance): void {
        this.tipsBalance = Balance.sub(this.tipsBalance, tip);
    }
}

class MakePostArgs {
    message: string = '';
    channelId: string = '';
    replyToPostId: string = '';
    repostPostId: string = '';
    displayImageLink: string = '';
    mediaLink: string = '';
    mediaType: string = '';
    tags: string[] = [];
}

class SendTipFromBalanceArgs {
    postId: string = '0';
    tipAmount: string = '0';
}

class SendMessageArgs {
    recipient: string = '';
    message: string = '';
    encrypted: boolean = false;
    channelId: string = '';
    replyToMessageTxId: string = '';
}

export class IdenaSocial {
    currentPostId: u128;
    posts: PersistentMap<u128, string>;
    idenians: PersistentMap<Address, IdenianDetails>;

    constructor() {
        this.currentPostId = u128.Zero;
        this.posts = PersistentMap.withStringPrefix<u128, string>('p:');
        this.idenians = PersistentMap.withStringPrefix<Address, IdenianDetails>('i:');
    }

    @mutateState
    makePost(args: MakePostArgs): void {
        util.assert(args.message.length > 0, 'message not supplied');

        if (Context.payAmount() > Balance.Zero) {
            Host.burn(Context.payAmount());
        }

        const postId = u128.add(this.currentPostId, u128.fromString('1'));
        this.posts.set(postId, util.toHexString(Context.caller(), true));

        this.currentPostId = postId;

        const posterDetails: IdenianDetails = this.idenians.get(Context.caller(), new IdenianDetails());
        this.idenians.set(Context.caller(), posterDetails);

        Host.emitEvent('makePost', [
            Context.caller().toBytes(),
            Bytes.fromu128(postId),
            Bytes.fromString(args.channelId),
            Bytes.fromString(args.message),
            Bytes.fromString(args.replyToPostId),
            Bytes.fromString(args.repostPostId),
            Bytes.fromString(args.displayImageLink),
            Bytes.fromString(args.mediaLink),
            Bytes.fromString(args.mediaType),
            Bytes.fromString(args.tags.toString()),
            Bytes.fromBytes(Context.payAmount().toBytes())
        ]);
    }

    @mutateState
    sendTip(postIdArg: string): void {
        const postId = u128.fromString(postIdArg);
        util.assert(postId > u128.Zero && postId <= this.currentPostId, 'non-existent post');

        const tipAmount: Balance = Context.payAmount();
        util.assert(tipAmount > Balance.Zero, 'cannot tip nothing');

        const posterHex: string = this.posts.get(postId, '');
        const poster = Address.fromBytes(util.decodeFromHex(posterHex));
        const receiverDetails: IdenianDetails = this.idenians.get(poster, new IdenianDetails());
        receiverDetails.addTipsBalance(tipAmount);
        this.idenians.set(poster, receiverDetails);

        Host.emitEvent('sendTip', [Context.caller().toBytes(), Bytes.fromu128(postId), Bytes.fromBytes(tipAmount.toBytes())]);
    }

    @mutateState
    sendTipFromBalance(args: SendTipFromBalanceArgs): void {
        const postId: u128 = u128.fromString(args.postId);
        const tipAmount: Balance = new Balance(u128.fromString(args.tipAmount));

        util.assert(postId > u128.Zero && postId <= this.currentPostId, 'non-existent post');
        util.assert(tipAmount > Balance.Zero, 'cannot tip nothing');

        const senderDetails: IdenianDetails = this.idenians.get(Context.caller(), new IdenianDetails());
        util.assert(tipAmount <= senderDetails.tipsBalance, 'insufficient funds');

        senderDetails.subtractTipsBalance(tipAmount);
        this.idenians.set(Context.caller(), senderDetails);

        const posterHex: string = this.posts.get(postId, '');
        const poster = Address.fromBytes(util.decodeFromHex(posterHex));
        const recieverDetails: IdenianDetails = this.idenians.get(poster, new IdenianDetails());
        recieverDetails.addTipsBalance(tipAmount);
        this.idenians.set(poster, recieverDetails);

        Host.emitEvent('sendTip', [Context.caller().toBytes(), Bytes.fromu128(postId), Bytes.fromBytes(tipAmount.toBytes())]);
    }

    @mutateState
    deposit(): void {
        const depositAmount: Balance = Context.payAmount();
        util.assert(depositAmount > Balance.Zero, 'cannot deposit nothing');

        const userDetails: IdenianDetails = this.idenians.get(Context.caller(), new IdenianDetails());
        userDetails.addTipsBalance(depositAmount);
        this.idenians.set(Context.caller(), userDetails);
    }

    @mutateState
    withdraw(withdrawAmount: Balance = Balance.Zero): void {
        util.assert(withdrawAmount > Balance.Zero, 'cannot withdraw nothing');

        const userDetails: IdenianDetails = this.idenians.get(Context.caller(), new IdenianDetails());
        util.assert(withdrawAmount <= userDetails.tipsBalance, 'insufficient funds');
        
        userDetails.subtractTipsBalance(withdrawAmount);
        this.idenians.set(Context.caller(), userDetails);

        Host.createTransferPromise(Context.caller(), withdrawAmount);
    }

    @mutateState
    updateAlias(alias: string = ''): void {
        util.assert(alias.length > 0, 'alias not supplied');

        const userDetails: IdenianDetails = this.idenians.get(Context.caller(), new IdenianDetails());
        userDetails.updateAlias(alias);
        this.idenians.set(Context.caller(), userDetails);

        Host.emitEvent('updateAlias', [Context.caller().toBytes(), Bytes.fromString(alias)]);
    }

    @mutateState
    sendMessage(args: SendMessageArgs): void {
        util.assert(args.message.length > 0, 'message not supplied');

        if (Context.payAmount() > Balance.Zero) {
            Host.burn(Context.payAmount());
        }

        Host.emitEvent('sendMessage', [
            Context.caller().toBytes(),
            Bytes.fromString(args.recipient),
            Bytes.fromString(args.channelId),
            Bytes.fromString(args.message),
            Bytes.fromString(args.encrypted.toString()),
            Bytes.fromString(args.replyToMessageTxId),
            Bytes.fromBytes(Context.payAmount().toBytes())
        ]);
    }
}
