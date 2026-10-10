import type { StaticImageData } from "next/image";
import bill from "../assets/bill.webp";
import coin from "../assets/coin.webp";
import enamel from "../assets/enamel.webp";
import gramophone from "../assets/gramophone.webp";
import kerosene from "../assets/kerosene.webp";
import matryoshka from "../assets/matryoshka.webp";
import postcard from "../assets/postcard.webp";
import samovar from "../assets/samovar.webp";
import stamp from "../assets/stamp.webp";
import sugar from "../assets/sugar.webp";
import teapot from "../assets/teapot.webp";
import watch from "../assets/watch.webp";

/** Фото обложки. `contain` — предмет на светлом фоне вписывается целиком (монета, купюра, марка). */
export type CategoryCover = { src: string; contain?: boolean };

const c = (img: StaticImageData, contain?: boolean): CategoryCover => ({ src: img.src, contain });

/**
 * Ячейки лотка «Популярные категории» в поиске на главной (концепт 09), в порядке показа.
 * Ключ — slug категории; на странице остаются только те, что есть в дереве БД.
 */
export const POPULAR_CELLS: [slug: string, cover: CategoryCover][] = [
  ["coins", c(coin, true)],
  ["banknotes", c(bill, true)],
  ["stamps", c(stamp, true)],
  ["postcards", c(postcard)],
  ["antiques-porcelain", c(teapot)],
  ["antiques-silver", c(sugar)],
  ["medals", c(enamel, true)],
  ["antiques-clocks", c(watch)],
  ["antiques-household", c(samovar)],
  ["toys-games", c(matryoshka)],
  ["antiques-musical", c(gramophone)],
  ["antiques-lighting", c(kerosene)],
];
