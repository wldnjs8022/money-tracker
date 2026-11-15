import { describe, expect, it } from "vitest";
import { finalSound, josa, quoted, withRo } from "./josa";

it("picks the particle by final consonant", () => {
  expect(josa("식비", "이", "가")).toBe("식비가");
  expect(josa("교통", "이", "가")).toBe("교통이");
  expect(josa("카페·간식", "이", "가")).toBe("카페·간식이");
  expect(josa("배달", "은", "는")).toBe("배달은");
  expect(josa("CU", "이", "가")).toBe("CU가");
});

describe("values ending in a digit or a Latin letter", () => {
  it("reads a final digit as its Sino-Korean number", () => {
    expect(josa("카드1", "을", "를")).toBe("카드1을"); // 일
    expect(josa("체크카드 1", "을", "를")).toBe("체크카드 1을");
    expect(josa("체크카드 3", "을", "를")).toBe("체크카드 3을"); // 삼
    expect(josa("통장 6", "이", "가")).toBe("통장 6이"); // 육
    expect(josa("카드2", "을", "를")).toBe("카드2를"); // 이
    expect(josa("GS25", "을", "를")).toBe("GS25를"); // 오
    expect(josa("이마트24", "은", "는")).toBe("이마트24는"); // 사
    expect(josa("카드10", "을", "를")).toBe("카드10을"); // 십
    expect(josa("1,000", "이", "가")).toBe("1,000이"); // 천
  });

  it("reads capital letters by name, with L, M, N and R ending in a consonant", () => {
    expect(josa("29CM", "을", "를")).toBe("29CM을"); // 엠
    expect(josa("CNN", "은", "는")).toBe("CNN은"); // 엔
    expect(josa("XL", "이", "가")).toBe("XL이"); // 엘
    expect(josa("KB", "을", "를")).toBe("KB를"); // 비
    expect(josa("OTT", "이", "가")).toBe("OTT가"); // 티
  });

  it("reads a lower-case word as English, where a final r is silent", () => {
    expect(josa("Steam", "을", "를")).toBe("Steam을");
    expect(josa("Coupang", "이", "가")).toBe("Coupang이");
    expect(josa("Hotel", "이", "가")).toBe("Hotel이");
    expect(josa("Uber", "을", "를")).toBe("Uber를");
    expect(josa("Toss", "을", "를")).toBe("Toss를");
  });

  it("treats anything else as a vowel ending", () => {
    expect(josa("", "을", "를")).toBe("를");
    expect(josa("커피!", "을", "를")).toBe("커피!를");
  });
});

describe("finalSound", () => {
  it("tells ㄹ apart from other final consonants", () => {
    expect(finalSound("생활")).toBe("rieul");
    expect(finalSound("카드7")).toBe("rieul"); // 칠
    expect(finalSound("카드8")).toBe("rieul"); // 팔
    expect(finalSound("RR")).toBe("rieul");
    expect(finalSound("교통")).toBe("other");
    expect(finalSound("카드0")).toBe("other"); // 영
    expect(finalSound("식비")).toBe("none");
    expect(finalSound("카드9")).toBe("none"); // 구
  });
});

describe("withRo", () => {
  it("uses 로 after a vowel or ㄹ and 으로 after any other final consonant", () => {
    expect(withRo("식비")).toBe("식비로");
    expect(withRo("생활")).toBe("생활로");
    expect(withRo("교통")).toBe("교통으로");
    expect(withRo("카드1")).toBe("카드1로");
    expect(withRo("카드7")).toBe("카드7로");
    expect(withRo("카드3")).toBe("카드3으로");
    expect(withRo("XL")).toBe("XL로");
    expect(withRo("29CM")).toBe("29CM으로");
    expect(withRo("OTT")).toBe("OTT로");
  });
});

describe("quoted", () => {
  it("quotes the value and keeps the particle outside the quotes", () => {
    expect(quoted("29CM", "을", "를")).toBe("‘29CM’을");
    expect(quoted("체크카드 1", "을", "를")).toBe("‘체크카드 1’을");
    expect(quoted("GS25", "을", "를")).toBe("‘GS25’를");
    expect(quoted("신용카드", "을", "를")).toBe("‘신용카드’를");
  });
});
