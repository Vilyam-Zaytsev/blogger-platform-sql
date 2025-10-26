import { DataSource, EntityTarget, FindOptionsWhere, Repository } from 'typeorm';
import { BaseEntityNumberId } from '../entities/base-entity-number-id';

export abstract class BaseRepository<Entity extends BaseEntityNumberId> {
  protected readonly repository: Repository<Entity>;

  protected constructor(
    protected readonly dataSource: DataSource,
    protected readonly entity: EntityTarget<Entity>,
  ) {
    this.repository = this.dataSource.getRepository(entity);
  }
  async save(entity: Entity): Promise<number> {
    const { id }: Entity = await this.repository.save(entity);

    return id;
  }

  async softDelete(id: number): Promise<void> {
    await this.repository.softDelete(id);
  }

  async getById(id: number): Promise<Entity | null> {
    return await this.repository.findOneBy({ id } as FindOptionsWhere<Entity>);
  }
}
