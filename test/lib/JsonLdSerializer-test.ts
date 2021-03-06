import {blankNode, defaultGraph, literal, namedNode, quad, triple} from "@rdfjs/data-model";
import {PassThrough} from "stream";
import {JsonLdSerializer} from "../../lib/JsonLdSerializer";

// tslint:disable:no-var-requires
const stringifyStream = require('stream-to-string');
const streamifyArray = require('streamify-array');

// tslint:disable:object-literal-sort-keys
describe('JsonLdSerializer', () => {

  let serializer: JsonLdSerializer;

  beforeEach(() => {
    serializer = new JsonLdSerializer();
  });

  it('should serialize an empty stream', async () => {
    const quads = [];
    return expect(await serialize(quads)).toEqual(
      [
      ],
    );
  });

  it('should serialize a single triple', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize a single triple with blank node subject', async () => {
    const quads = [
      triple(blankNode('b1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "_:b1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize two triples with different subjects and predicates', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
      triple(namedNode('http://ex.org/myid2'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
        {
          "@id": "http://ex.org/myid2",
          "http://ex.org/pred2": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize two triples with different subjects but equal predicates', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
      triple(namedNode('http://ex.org/myid2'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
        {
          "@id": "http://ex.org/myid2",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize two triples with equal subjects but different predicates', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
          "http://ex.org/pred2": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize two triples with equal subjects and predicates', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj2')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
            { "@id": "http://ex.org/obj2" },
          ],
        },
      ]);
  });

  it('should serialize rdf:type predicates to @type with compacted object IRIs', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "@type": [
            "http://ex.org/obj1",
          ],
        },
      ]);
  });

  it('should not serialize rdf:type predicates to @type if useRdfType is true', async () => {
    const customSerializer = new JsonLdSerializer({ useRdfType: true });
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads, customSerializer)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize string literals', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), literal('abc')),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), literal('def')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@value": "abc" },
            { "@value": "def" },
          ],
        },
      ]);
  });

  it('should serialize language-tagged literals', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), literal('abc', 'en')),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), literal('def', 'nl')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@value": "abc", "@language": "en" },
            { "@value": "def", "@language": "nl" },
          ],
        },
      ]);
  });

  it('should serialize literals with unknown type', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'),
        literal('abc', namedNode('http://ex.org/type'))),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'),
        literal('def', namedNode('http://ex.org/type'))),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@value": "abc", "@type": "http://ex.org/type" },
            { "@value": "def", "@type": "http://ex.org/type" },
          ],
        },
      ]);
  });

  it('should serialize literals with integer type', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'),
        literal('10', namedNode('http://www.w3.org/2001/XMLSchema#integer'))),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'),
        literal('20', namedNode('http://www.w3.org/2001/XMLSchema#integer'))),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@value": "10", "@type": "http://www.w3.org/2001/XMLSchema#integer" },
            { "@value": "20", "@type": "http://www.w3.org/2001/XMLSchema#integer" },
          ],
        },
      ]);
  });

  it('should serialize literals with integer type when useNativeTypes is true', async () => {
    const customSerializer = new JsonLdSerializer({ useNativeTypes: true });
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'),
        literal('10', namedNode('http://www.w3.org/2001/XMLSchema#integer'))),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'),
        literal('20', namedNode('http://www.w3.org/2001/XMLSchema#integer'))),
    ];
    return expect(await serialize(quads, customSerializer)).toEqual(
      [
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@value": 10 },
            { "@value": 20 },
          ],
        },
      ]);
  });

  it('should fail to serialize invalid literals with integer type when useNativeTypes is true', async () => {
    const customSerializer = new JsonLdSerializer({ useNativeTypes: true });
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'),
        literal('abc', namedNode('http://www.w3.org/2001/XMLSchema#integer'))),
    ];
    return expect(serialize(quads, customSerializer)).rejects.toThrow(new Error('Invalid xsd:integer value \'abc\''));
  });

  it('should serialize a single quad in a custom graph', async () => {
    const quads = [
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "@graph": [
            {
              "@id": "_:b1",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize two quads in a the same graph, with equal subject and predicate', async () => {
    const quads = [
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "@graph": [
            {
              "@id": "_:b1",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize two quads in a the same graph, with equal subject and different predicate', async () => {
    const quads = [
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
      quad(blankNode('b1'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "@graph": [
            {
              "@id": "_:b1",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
              ],
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj1" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize two quads in a the same graph, with different subject and predicate', async () => {
    const quads = [
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "@graph": [
            {
              "@id": "_:b1",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
              ],
            },
            {
              "@id": "_:b2",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize two equal triples in a different graph', async () => {
    const quads = [
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph2')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "@graph": [
            {
              "@id": "_:b1",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
              ],
            },
          ],
        },
        {
          "@id": "http://ex.org/mygraph2",
          "@graph": [
            {
              "@id": "_:b1",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize two non-equal triples in a different graph', async () => {
    const quads = [
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph2')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "@graph": [
            {
              "@id": "_:b1",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
              ],
            },
          ],
        },
        {
          "@id": "http://ex.org/mygraph2",
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize a triple followed by a quad', async () => {
    const quads = [
      triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph2')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "_:b1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
        {
          "@id": "http://ex.org/mygraph2",
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize a quad followed by a triple', async () => {
    const quads = [
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph2')),
      triple(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph2",
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
        {
          "@id": "_:b1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize a quad with graph equal to last subject', async () => {
    const quads = [
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize a quad with graph equal to last subject followed by another triple in that graph', async () => {
    const quads = [
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
      quad(namedNode('http://ex.org/mysubject'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
            {
              "@id": "http://ex.org/mysubject",
              "http://ex.org/pred1": [
                { "@id": "http://ex.org/obj1" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize a quad with graph equal to last subject followed by another triple', async () => {
    const quads = [
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
      triple(namedNode('http://ex.org/mysubject'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
        {
          "@id": "http://ex.org/mysubject",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize a triple with subject equal to last named graph', async () => {
    const quads = [
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize a quad with graph equal to last and next subject', async () => {
    const quads = [
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
          "http://ex.org/pred2": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
      ]);
  });

  it('should serialize a triple with subject equal to last named graph followed by another quad', async () => {
    const quads = [
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph2')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
        },
        {
          "@id": "http://ex.org/mygraph2",
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize a quad with graph equal to last subject, followed by another quad', async () => {
    const quads = [
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph2')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://ex.org/mygraph1",
          "http://ex.org/pred1": [
            { "@id": "http://ex.org/obj1" },
          ],
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
        {
          "@id": "http://ex.org/mygraph2",
          "@graph": [
            {
              "@id": "_:b2",
              "http://ex.org/pred2": [
                { "@id": "http://ex.org/obj2" },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize a complex mix of triples and quads', async () => {
    const quads = [
      triple(namedNode('http://data.wikipedia.org/snaks/Assertions'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://data.wikipedia.org/vocab#SnakSet')),
      triple(namedNode('http://data.wikipedia.org/snaks/Assertions'),
        namedNode('http://data.wikipedia.org/vocab#assertedBy'),
        literal('http://gregkellogg.net/foaf#me')),
      quad(namedNode('http://data.wikipedia.org/snaks/BerlinFact'),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://data.wikipedia.org/vocab#Snak'),
        namedNode('http://data.wikipedia.org/snaks/Assertions')),
      quad(namedNode('http://data.wikipedia.org/snaks/BerlinFact'),
        namedNode('http://data.wikipedia.org/vocab#assertedBy'),
        literal('http://www.statistik-berlin-brandenburg.de/'),
        namedNode('http://data.wikipedia.org/snaks/Assertions')),
      quad(namedNode('http://en.wikipedia.org/wiki/Berlin'),
        namedNode('http://data.wikipedia.org/vocab#population'),
        literal('3499879', namedNode('http://www.w3.org/2001/XMLSchema#integer')),
        namedNode('http://data.wikipedia.org/snaks/BerlinFact')),
    ];
    return expect(await serialize(quads)).toEqual(
      [
        {
          "@id": "http://data.wikipedia.org/snaks/Assertions",
          "@type": ["http://data.wikipedia.org/vocab#SnakSet"],
          "http://data.wikipedia.org/vocab#assertedBy": [
            { "@value": "http://gregkellogg.net/foaf#me" },
          ],
          "@graph": [
            {
              "@id": "http://data.wikipedia.org/snaks/BerlinFact",
              "@type": ["http://data.wikipedia.org/vocab#Snak"],
              "http://data.wikipedia.org/vocab#assertedBy": [
                { "@value": "http://www.statistik-berlin-brandenburg.de/" },
              ],
            },
          ],
        },
        {
          "@id": "http://data.wikipedia.org/snaks/BerlinFact",
          "@graph": [
            {
              "@id": "http://en.wikipedia.org/wiki/Berlin",
              "http://data.wikipedia.org/vocab#population": [
                {
                  "@value": "3499879",
                  "@type": "http://www.w3.org/2001/XMLSchema#integer",
                },
              ],
            },
          ],
        },
      ]);
  });

  it('should serialize a triple with a base IRI', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://type.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads, new JsonLdSerializer({ baseIRI: 'http://ex.org/' }))).toEqual(
      {
        "@context": {
          "@base": "http://ex.org/",
        },
        "@graph": [
          {
            "@id": "myid1",
            "http://type.org/pred1": [
              { "@id": "obj1" },
            ],
          },
        ],
      });
  });

  it('should serialize a triple with a base IRI but not emit context it if excludeContext is true', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://type.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads, new JsonLdSerializer({ baseIRI: 'http://ex.org/', excludeContext: true })))
      .toEqual([
        {
          "@id": "myid1",
          "http://type.org/pred1": [
            { "@id": "obj1" },
          ],
        },
      ]);
  });

  it('should serialize a triple with a context', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://type.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    const context = {
      "@base": "http://ex.org/",
      "@vocab": "http://type.org/",
    };
    return expect(await serialize(quads, new JsonLdSerializer({ context }))).toEqual(
      {
        "@context": {
          "@base": "http://ex.org/",
          "@vocab": "http://type.org/",
        },
        "@graph": [
          {
            "@id": "myid1",
            "pred1": [
              { "@id": "obj1" },
            ],
          },
        ],
      });
  });

  it('should serialize a triple with a context but not emit it if excludeContext is true', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://type.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    const context = {
      "@base": "http://ex.org/",
      "@vocab": "http://type.org/",
    };
    return expect(await serialize(quads, new JsonLdSerializer({ context, excludeContext: true }))).toEqual(
      [
        {
          "@id": "myid1",
          "pred1": [
            { "@id": "obj1" },
          ],
        },
      ]);
  });

  it('should serialize triples with a complex context with prefixes', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://type.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    const context = {
      ex: "http://ex.org/",
      type: "http://type.org/",
    };
    return expect(await serialize(quads, new JsonLdSerializer({ context }))).toEqual(
      {
        "@context": {
          ex: "http://ex.org/",
          type: "http://type.org/",
        },
        "@graph": [
          {
            "@id": "ex:myid1",
            "type:pred1": [
              { "@id": "ex:obj1" },
            ],
          },
        ],
      });
  });

  it('should serialize triples with a complex context with alias terms', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://type.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    const context = {
      id: "http://ex.org/myid1",
      p: "http://type.org/pred1",
      o: "http://ex.org/obj1",
    };
    return expect(await serialize(quads, new JsonLdSerializer({ context }))).toEqual(
      {
        "@context": {
          id: "http://ex.org/myid1",
          p: "http://type.org/pred1",
          o: "http://ex.org/obj1",
        },
        "@graph": [
          {
            "@id": "http://ex.org/myid1",
            "p": [
              { "@id": "http://ex.org/obj1" },
            ],
          },
        ],
      });
  });

  async function serialize(quadsArray, customSerializer?) {
    return JSON.parse(await stringifyStream(streamifyArray(quadsArray).pipe(customSerializer || serializer)));
  }

  describe('#import', () => {
    it('should parse a stream', async () => {
      const quads = [
        triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), literal('abc')),
        triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), literal('def')),
      ];
      return expect(JSON.parse(await stringifyStream(serializer.import(streamifyArray(quads))))).toEqual([
        {
          "@id": "http://ex.org/myid1",
          "http://ex.org/pred1": [
            { "@value": "abc" },
            { "@value": "def" },
          ],
        },
      ]);
    });

    it('should parse another stream', async () => {
      const quads = [
        triple(namedNode('http://ex.org/myid2'), namedNode('http://ex.org/pred1'), literal('abc')),
        triple(namedNode('http://ex.org/myid2'), namedNode('http://ex.org/pred1'), literal('def')),
      ];
      return expect(JSON.parse(await stringifyStream(serializer.import(streamifyArray(quads))))).toEqual([
        {
          "@id": "http://ex.org/myid2",
          "http://ex.org/pred1": [
            { "@value": "abc" },
            { "@value": "def" },
          ],
        },
      ]);
    });

    it('should forward error events', async () => {
      const stream = new PassThrough();
      stream._read = () => stream.emit('error', new Error('my error'));
      return expect(stringifyStream(serializer.import(stream))).rejects.toThrow(new Error('my error'));
    });
  });

  describe('list', () => {
    it('should emit an empty list in a triple', async () => {
      serializer.write(quad(namedNode('http://ex.org/subj1'), namedNode('http://ex.org/pred1'),
        await serializer.list([])));
      serializer.end();
      return expect(JSON.parse(await stringifyStream(serializer))).toEqual([
        {
          "@id": "http://ex.org/subj1",
          "http://ex.org/pred1": [
            {
              "@list": [],
            },
          ],
        },
      ]);
    });

    it('should emit a list with named nodes in a triple', async () => {
      serializer.write(quad(namedNode('http://ex.org/subj1'), namedNode('http://ex.org/pred1'),
        await serializer.list([
          namedNode('a'),
          namedNode('b'),
        ])));
      serializer.end();
      return expect(JSON.parse(await stringifyStream(serializer))).toEqual([
        {
          "@id": "http://ex.org/subj1",
          "http://ex.org/pred1": [
            {
              "@list": [
                { '@id': 'a' },
                { '@id': 'b' },
              ],
            },
          ],
        },
      ]);
    });

    it('should emit a list with literals in a triple', async () => {
      serializer.write(quad(namedNode('http://ex.org/subj1'), namedNode('http://ex.org/pred1'),
        await serializer.list([
          literal('a'),
          literal('b'),
        ])));
      serializer.end();
      return expect(JSON.parse(await stringifyStream(serializer))).toEqual([
        {
          "@id": "http://ex.org/subj1",
          "http://ex.org/pred1": [
            {
              "@list": [
                { '@value': 'a' },
                { '@value': 'b' },
              ],
            },
          ],
        },
      ]);
    });
  });

});

describe('JsonLdSerializer with pretty-printing', () => {

  let serializer: JsonLdSerializer;

  beforeEach(() => {
    serializer = new JsonLdSerializer({ space: '  ' });
  });

  it('should serialize an empty stream', async () => {
    const quads = [];
    return expect(await serialize(quads)).toEqual(`[
]
`);
  });

  it('should serialize a single triple', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/myid",
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
    ]
  }
]
`);
  });

  it('should serialize two triples with different subjects and predicates', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
      triple(namedNode('http://ex.org/myid2'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/myid1",
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
    ]
  },
  {
    "@id": "http://ex.org/myid2",
    "http://ex.org/pred2": [
      {
        "@id": "http://ex.org/obj1"
      }
    ]
  }
]
`);
  });

  it('should serialize two triples with different subjects but equal predicates', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
      triple(namedNode('http://ex.org/myid2'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/myid1",
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
    ]
  },
  {
    "@id": "http://ex.org/myid2",
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
    ]
  }
]
`);
  });

  it('should serialize two triples with equal subjects but different predicates', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred2'), namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/myid1",
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
    ],
    "http://ex.org/pred2": [
      {
        "@id": "http://ex.org/obj1"
      }
    ]
  }
]
`);
  });

  it('should serialize two triples with equal subjects and predicates', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj1')),
      triple(namedNode('http://ex.org/myid1'), namedNode('http://ex.org/pred1'), namedNode('http://ex.org/obj2')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/myid1",
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
      ,
      {
        "@id": "http://ex.org/obj2"
      }
    ]
  }
]
`);
  });

  it('should serialize two quads', async () => {
    const quads = [
      quad(blankNode('b1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1'), namedNode('http://ex.org/mygraph1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph2')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/mygraph1",
    "@graph": [
      {
        "@id": "_:b1",
        "http://ex.org/pred1": [
          {
            "@id": "http://ex.org/obj1"
          }
        ]
      }
    ]
  },
  {
    "@id": "http://ex.org/mygraph2",
    "@graph": [
      {
        "@id": "_:b2",
        "http://ex.org/pred2": [
          {
            "@id": "http://ex.org/obj2"
          }
        ]
      }
    ]
  }
]
`);
  });

  it('should serialize a quad with graph equal to last subject', async () => {
    const quads = [
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/mygraph1",
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
    ],
    "@graph": [
      {
        "@id": "_:b2",
        "http://ex.org/pred2": [
          {
            "@id": "http://ex.org/obj2"
          }
        ]
      }
    ]
  }
]
`);
  });

  it('should serialize a quad with graph equal to last and next subject', async () => {
    const quads = [
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj1')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/mygraph1",
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
    ],
    "@graph": [
      {
        "@id": "_:b2",
        "http://ex.org/pred2": [
          {
            "@id": "http://ex.org/obj2"
          }
        ]
      }
    ],
    "http://ex.org/pred2": [
      {
        "@id": "http://ex.org/obj1"
      }
    ]
  }
]
`);
  });

  it('should serialize a triple with subject equal to last named graph followed by another quad', async () => {
    const quads = [
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph1')),
      triple(namedNode('http://ex.org/mygraph1'), namedNode('http://ex.org/pred1'),
        namedNode('http://ex.org/obj1')),
      quad(blankNode('b2'), namedNode('http://ex.org/pred2'),
        namedNode('http://ex.org/obj2'), namedNode('http://ex.org/mygraph2')),
    ];
    return expect(await serialize(quads)).toEqual(`[
  {
    "@id": "http://ex.org/mygraph1",
    "@graph": [
      {
        "@id": "_:b2",
        "http://ex.org/pred2": [
          {
            "@id": "http://ex.org/obj2"
          }
        ]
      }
    ],
    "http://ex.org/pred1": [
      {
        "@id": "http://ex.org/obj1"
      }
    ]
  },
  {
    "@id": "http://ex.org/mygraph2",
    "@graph": [
      {
        "@id": "_:b2",
        "http://ex.org/pred2": [
          {
            "@id": "http://ex.org/obj2"
          }
        ]
      }
    ]
  }
]
`);
  });

  it('should serialize a triple with a context', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://type.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    const context = {
      "@base": "http://ex.org/",
      "@vocab": "http://type.org/",
    };
    return expect(await serialize(quads, new JsonLdSerializer({ context, space: '  ' }))).toEqual(`{
  "@context":
  {
    "@base": "http://ex.org/",
    "@vocab": "http://type.org/"
  },
  "@graph": [
    {
      "@id": "myid1",
      "pred1": [
        {
          "@id": "obj1"
        }
      ]
    }
  ]
}
`);
  });

  it('should serialize a triple with a context compactly', async () => {
    const quads = [
      triple(namedNode('http://ex.org/myid1'), namedNode('http://type.org/pred1'),
        namedNode('http://ex.org/obj1')),
    ];
    const context = {
      "@base": "http://ex.org/",
      "@vocab": "http://type.org/",
    };
    // tslint:disable-next-line:max-line-length
    return expect(await serialize(quads, new JsonLdSerializer({ context }))).toEqual(`{"@context":{"@base":"http://ex.org/","@vocab":"http://type.org/"},"@graph":[{"@id":"myid1","pred1":[{"@id":"obj1"}]}]}`);
  });

  async function serialize(quadsArray, customSerializer?) {
    return await stringifyStream(streamifyArray(quadsArray).pipe(customSerializer || serializer));
  }

});
