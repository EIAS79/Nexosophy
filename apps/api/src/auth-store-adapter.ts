import type { IdentityStorePort, ProviderIdentitySnapshot } from "@nexosophy/auth";
import {
  getInternalIdentityByProviderUserId,
  handleProviderIdentityDeletion,
  markProviderIdentityEventApplied,
  provisionIdentity,
  type createDatabasePool,
} from "@nexosophy/db";

type DatabasePool = ReturnType<typeof createDatabasePool>;

export function createDatabaseIdentityStore(pool: DatabasePool): IdentityStorePort {
  return {
    async findByProviderUserId(provider, providerUserId) {
      const identity = await getInternalIdentityByProviderUserId(
        pool,
        provider,
        providerUserId,
      );

      if (!identity) return null;

      return {
        internalUserId: identity.internalUserId,
        externalIdentityId: identity.externalIdentityId,
        provider: identity.provider,
        providerUserId: identity.providerUserId,
        accountState: identity.accountStatus,
        identityDisabled: identity.identityDisabledAt !== null,
      };
    },

    async provision(snapshot: ProviderIdentitySnapshot) {
      return provisionIdentity(pool, {
        provider: snapshot.provider,
        providerUserId: snapshot.providerUserId,
        primaryEmail: snapshot.primaryEmail,
        displayName: snapshot.displayName,
        disabled: snapshot.disabled,
        providerUpdatedAt: snapshot.providerUpdatedAt,
      });
    },

    async sync(snapshot, eventOccurredAt) {
      await provisionIdentity(pool, {
        provider: snapshot.provider,
        providerUserId: snapshot.providerUserId,
        primaryEmail: snapshot.primaryEmail,
        disabled: snapshot.disabled,
        providerUpdatedAt: snapshot.providerUpdatedAt,
      });

      if (eventOccurredAt) {
        await markProviderIdentityEventApplied(
          pool,
          snapshot.provider,
          snapshot.providerUserId,
          eventOccurredAt,
        );
      }
    },

    async handleProviderDeletion(provider, providerUserId, eventOccurredAt) {
      await handleProviderIdentityDeletion(
        pool,
        provider,
        providerUserId,
        eventOccurredAt,
      );
    },
  };
}
