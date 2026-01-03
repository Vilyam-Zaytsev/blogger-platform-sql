import { EntityManager, EntityTarget, FindOptionsWhere, Repository } from 'typeorm';
import { BaseEntity } from '../entities/base-entity';
import { TransactionHelper } from '../../trasaction.helper';

export abstract class BaseRepository<Entity extends BaseEntity> {
  protected constructor(
    protected readonly entityTarget: EntityTarget<Entity>,
    protected readonly transactionHelper: TransactionHelper,
  ) {}

  async save(entity: Entity): Promise<number> {
    const { id }: Entity = await this.getRepository().save(entity);

    return id;
  }

  async softDelete(id: number): Promise<void> {
    await this.getRepository().softDelete(id);
  }

  async getById(id: number): Promise<Entity | null> {
    return await this.getRepository().findOneBy({ id } as FindOptionsWhere<Entity>);
  }

  protected getRepository(): Repository<Entity> {
    const manager: EntityManager = this.transactionHelper.getManager();
    return manager.getRepository(this.entityTarget);
  }
}
