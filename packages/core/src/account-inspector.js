import { Horizon } from '@stellar/stellar-sdk';
export var AccountType;
(function (AccountType) {
    AccountType["CLASSIC_FUNDED"] = "CLASSIC_FUNDED";
    AccountType["CLASSIC_UNFUNDED"] = "CLASSIC_UNFUNDED";
    AccountType["SOROBAN_CONTRACT"] = "SOROBAN_CONTRACT";
    AccountType["UNKNOWN"] = "UNKNOWN";
})(AccountType || (AccountType = {}));
export var AuthPath;
(function (AuthPath) {
    AuthPath["SEP10"] = "SEP10";
    AuthPath["SEP45"] = "SEP45";
    AuthPath["SEP10_OR_SEP45"] = "SEP10_OR_SEP45";
    AuthPath["UNSUPPORTED"] = "UNSUPPORTED";
})(AuthPath || (AuthPath = {}));
export class AccountInspector {
    constructor(config = {}) {
        Object.defineProperty(this, "server", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const horizonUrl = config.horizonUrl ?? 'https://horizon-testnet.stellar.org';
        this.server = new Horizon.Server(horizonUrl);
    }
    async inspect(address) {
        const type = await this.determineAccountType(address);
        if (type === AccountType.CLASSIC_UNFUNDED) {
            return {
                type,
                address,
            };
        }
        if (type === AccountType.SOROBAN_CONTRACT) {
            return {
                type,
                address,
            };
        }
        try {
            const account = await this.server.loadAccount(address);
            return {
                type,
                address,
                balances: account.balances,
                sequence: account.sequence,
                thresholds: {
                    low_threshold: account.thresholds.low_threshold,
                    med_threshold: account.thresholds.med_threshold,
                    high_threshold: account.thresholds.high_threshold,
                },
                flags: {
                    auth_required: account.flags.auth_required,
                    auth_revocable: account.flags.auth_revocable,
                    auth_immutable: account.flags.auth_immutable,
                },
            };
        }
        catch (error) {
            return {
                type: AccountType.UNKNOWN,
                address,
            };
        }
    }
    resolveAuthPath(address, capabilities) {
        if (!capabilities.supportsSep10 && !capabilities.supportsSep45) {
            return AuthPath.UNSUPPORTED;
        }
        if (capabilities.supportsSep10 && capabilities.supportsSep45) {
            return AuthPath.SEP10_OR_SEP45;
        }
        const isContract = this.looksLikeContract(address);
        if (isContract && capabilities.supportsSep45) {
            return AuthPath.SEP45;
        }
        if (!isContract && capabilities.supportsSep10) {
            return AuthPath.SEP10;
        }
        if (capabilities.supportsSep10) {
            return AuthPath.SEP10;
        }
        if (capabilities.supportsSep45) {
            return AuthPath.SEP45;
        }
        return AuthPath.UNSUPPORTED;
    }
    async determineAccountType(address) {
        if (this.looksLikeContract(address)) {
            return AccountType.SOROBAN_CONTRACT;
        }
        try {
            await this.server.loadAccount(address);
            return AccountType.CLASSIC_FUNDED;
        }
        catch (error) {
            if (error?.response?.status === 404) {
                return AccountType.CLASSIC_UNFUNDED;
            }
            return AccountType.UNKNOWN;
        }
    }
    looksLikeContract(address) {
        return address.startsWith('C');
    }
}
//# sourceMappingURL=account-inspector.js.map