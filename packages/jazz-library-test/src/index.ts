import { co, CoMap, CoList, CoStream } from "jazz-tools";

class TestItem extends CoMap {
  name = co.string;
}

export class TestList extends CoList.Of(TestItem) {}

export class TestRecord extends CoMap.Record(co.ref(TestItem)) {}

export class TestStream extends CoStream.Of(co.ref(TestItem)) {}
