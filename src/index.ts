const SLACK_URL = PropertiesService.getScriptProperties().getProperty(
  "SLACK_URL"
);
const SHEET = SpreadsheetApp.getActive().getSheetByName("シート1");
const NS = XmlService.getNamespace("http://www.w3.org/2005/Atom");

class PaperNum {
  yearMonth: number;
  index: number;

  constructor(yearMonth: number, index: number) {
    this.yearMonth = isNaN(yearMonth) ? -1 : yearMonth;
    this.index = isNaN(index) ? -1 : index;
  }

  newerThan(other: PaperNum): boolean {
    return (
      this.yearMonth > other.yearMonth ||
      (this.yearMonth === other.yearMonth && this.index > other.index)
    );
  }
}

class DataBlock {
  attachments: object[];
  latestPaperNum: PaperNum;

  constructor(attachment: object, paperNum: PaperNum) {
    this.attachments = [attachment];
    this.latestPaperNum = paperNum;
  }

  full(): boolean {
    return this.attachments.length === 20;
  }

  insert(attachment: object, paperNum: PaperNum): void {
    if (this.full()) return;
    this.attachments.push(attachment);
    if (this.latestPaperNum < paperNum) this.latestPaperNum = paperNum;
  }
}

const getPaperNumsAndVersion = (str: string): [PaperNum, number] => {
  const re = /(\d{4})\.(\d+)v(\d+)/;
  const match = str.match(re);
  return [
    new PaperNum(parseInt(match[1], 10), parseInt(match[2], 10)),
    parseInt(match[3], 10)
  ];
};

/* eslint-disable @typescript-eslint/camelcase */
const getAuthorStr = (item: GoogleAppsScript.XML_Service.Element): string => {
  return item
    .getChildren("author", NS)
    .map(author => author.getChildText("name", NS))
    .join(", ");
};
/* eslint-enable @typescript-eslint/camelcase */

/* eslint-disable @typescript-eslint/camelcase */
const getCategoryStr = (item: GoogleAppsScript.XML_Service.Element): string => {
  return item
    .getChildren("category", NS)
    .map(category => {
      const str = category.getAttribute("term").getValue();
      if (str.match(/\./)) return str;
    })
    .filter(str => !!str)
    .join(", ");
};
/* eslint-enable @typescript-eslint/camelcase */

const getDataFromArxiv = (cats: string[]): DataBlock[] => {
  const donePaperNums = new PaperNum(
    parseInt(SHEET.getRange(2, 1).getValue(), 10),
    parseInt(SHEET.getRange(2, 2).getValue(), 10)
  );

  const url =
    "http://export.arxiv.org/api/query?sortBy=lastUpdatedDate&sortOrder=descending&max_results=40&search_query=" +
    cats.map((cat: string) => "cat:" + cat).join("+OR+");
  const xml = XmlService.parse(UrlFetchApp.fetch(url).getContentText());
  const items = xml.getRootElement().getChildren("entry", NS);

  const dataBlocks: DataBlock[] = [];
  for (const item of items.reverse()) {
    const [paperNums, version] = getPaperNumsAndVersion(
      item.getChild("id", NS).getText()
    );
    if (version === 1 && paperNums.newerThan(donePaperNums)) {
      /* eslint-disable @typescript-eslint/camelcase */
      const attachment = {
        color: "#36a64f",
        author_name: getAuthorStr(item),
        title: item.getChildText("title", NS),
        title_link: item.getChildText("id", NS),
        text: getCategoryStr(item)
      };
      /* eslint-enable @typescript-eslint/camelcase */

      if (dataBlocks.length == 0 || dataBlocks[dataBlocks.length - 1].full()) {
        dataBlocks.push(new DataBlock(attachment, paperNums));
      } else {
        dataBlocks[dataBlocks.length - 1].insert(attachment, paperNums);
      }
    }
  }

  return dataBlocks;
};

const postToSlack = (dataBlocks: DataBlock[]): void => {
  for (const dataBlock of dataBlocks) {
    if (dataBlock.attachments.length === 0) continue;

    const options = {
      method: "POST",
      headers: { "Content-type": "application/json" },
      muteHttpExceptions: true,
      payload: JSON.stringify({ attachments: dataBlock.attachments })
    };

    const response = UrlFetchApp.fetch(SLACK_URL, options);
    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log(
        `Request failed. Expected 200, got ${responseCode}: ${response.getContentText()}`
      );
      return;
    } else {
      SHEET.getRange(2, 1).setValue(dataBlock.latestPaperNum.yearMonth);
      SHEET.getRange(2, 2).setValue(dataBlock.latestPaperNum.index);
    }
  }
};

export function main(): void {
  const cats = ["cs.CV"];
  const dataBlocks = getDataFromArxiv(cats);
  postToSlack(dataBlocks);
}
