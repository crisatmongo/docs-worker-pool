import { AuthorizationError, InvalidJobError } from "../errors/errors";
import validator from "validator";
import { IJob } from "../entities/job";
import { IFileSystemServices } from "../services/fileServices";
import { RepoEntitlementsRepository } from "../repositories/repoEntitlementsRepository";
import { RepoBranchesRepository } from "../repositories/repoBranchesRepository";

export interface IJobValidator {
    throwIfJobInvalid(job: IJob): Promise<void>;
    throwIfBranchNotConfigured(job: IJob): Promise<void>;
    throwIfUserNotEntitled(job: IJob): Promise<void>;
}

export class JobValidator implements IJobValidator {
    _fileSystemService: IFileSystemServices;
    _repoEntitlementRepository: RepoEntitlementsRepository;
    _repoBranchesRepository: RepoBranchesRepository;
    constructor(fileSystemService: IFileSystemServices, repoEntitlementRepository: RepoEntitlementsRepository) {
        this._fileSystemService = fileSystemService;
        this._repoEntitlementRepository = repoEntitlementRepository;
    }

    async throwIfUserNotEntitled(job: IJob): Promise<void> {
        const entitlementsObject = await this._repoEntitlementRepository.getRepoEntitlementsByGithubUsername(job.user);
        if (!entitlementsObject || !entitlementsObject.repos || entitlementsObject.repos.indexOf(`${job.payload.repoOwner}/${job.payload.repoName}`) === -1) {
            throw new AuthorizationError(`${job.user} is not entitled for repo ${job.payload.repoName}`);
        }
    }

    async throwIfBranchNotConfigured(job: IJob): Promise<void> {
        const branchesObject = await this._repoBranchesRepository.getConfiguredBranchesByGithubRepoName(job.payload.repoName);
        if (!branchesObject || !branchesObject.branches) {
          throw new AuthorizationError(`${job.payload.repoName} is not configured for deployment`)
        }
        if (branchesObject.findIndex(obj => obj.gitBranchName == job.payload.branchName) === -1) {
          throw new AuthorizationError(`${job.payload.branchName} in the ${job.payload.repoName} repository is not configured for deployment.`)
        }
    }

    public async throwIfJobInvalid(job: IJob): Promise<void> {
        this._validateInput(job);
        await this.throwIfUserNotEntitled(job);
        await this.throwIfBranchNotConfigured(job);
    }

    private _validateInput(job: IJob): void {
        if (!(["githubPush", "productionDeploy", "publishDochub", "regression"].includes(job.payload.jobType))) {
            throw new InvalidJobError("Invalid JobType");
        }
        if (!job.payload.repoName || !this.safeString(job.payload.repoName)) {
            throw new InvalidJobError("Invalid Reponame");
        }
        if (!job.payload.branchName || !this.safeString(job.payload.branchName)) {
            throw new InvalidJobError("Invalid Branchname");
        }
        if (!job.payload.repoOwner || !this.safeString(job.payload.repoOwner)) {
            throw new InvalidJobError("Invalid RepoOwner");
        }
    }

    private safeString(stringToCheck: string) {
        return (
            validator.isAscii(stringToCheck) &&
            validator.matches(stringToCheck, /^((\w)*[-.]?(\w)*)*$/)
        );
    }

}