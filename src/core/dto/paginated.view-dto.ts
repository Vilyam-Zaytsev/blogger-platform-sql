export abstract class PaginatedViewDto<T> {
  pagesCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
  abstract items: T[];

  static mapToView<T>(data: {
    items: T[];
    page: number;
    size: number;
    totalCount: number;
  }): PaginatedViewDto<T> {
    return {
      totalCount: data.totalCount,
      pagesCount: Math.ceil(data.totalCount / data.size),
      page: data.page,
      pageSize: data.size,
      items: data.items,
    };
  }
}
