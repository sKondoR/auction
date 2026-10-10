/**
 * Пометка блока, по нижнему краю которого заканчивается открытая панель поиска (hero главной).
 * Ставится на элемент как `{...SEARCH_FLOOR}`; на страницах без пометки панель — по высоте содержимого.
 */
export const SEARCH_FLOOR = { "data-search-floor": "" } as const;
export const SEARCH_FLOOR_SELECTOR = "[data-search-floor]";
