import { expect, test } from 'vitest';
import { safeFollowUps } from '../src/lib/follow-ups';
import { readSearchEvents } from '../src/lib/stream';

test('optional suggestion validation bounds count/length and drops duplicates, markup and old filler',()=>{
  const question='Why does RSA decryption recover the original message?';
  expect(safeFollowUps([question,question,'<script>bad</script>'])).toEqual([question]);
  expect(safeFollowUps(Array(4).fill(question))).toEqual([]);
  expect(safeFollowUps(['x'.repeat(161),null,'What are the key facts about RSA?'])).toEqual([]);
  expect(safeFollowUps(undefined)).toEqual([]);
});
test('malformed suggestion events do not invalidate a completed answer',async()=>{
  for(const payload of ['{','null','{"questions":"bad"}','{"questions":[null]}']){
    const wire='event: delta\ndata: {"text":"Answer"}\n\nevent: follow_ups\ndata: '+payload+'\n\nevent: done\ndata: {"conversationId":null}\n\n';
    const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(wire));c.close();}});
    const events=[];for await(const event of readSearchEvents(stream))events.push(event);
    expect(events.map(event=>event.event)).toEqual(['delta','follow_ups','done']);
    expect(events[1]!.data).toEqual({questions:[]});
  }
});
