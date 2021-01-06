import {
  BinaryPipeline,
  BinaryTypeCachePipeline,
  DeliverabilityManagerBinaryProtocol,
  QueryManagerBinaryProtocol,
  UndefinedMessageIDGuardPipeline,
} from '@electricui/protocol-binary'
import {
  CodecDuplexPipeline,
  ConnectionInterface,
  ConnectionStaticMetadataReporter,
  DiscoveryHintConsumer,
  Hint,
  TransportFactory,
} from '@electricui/core'
import {
  WEBSOCKETS_TRANSPORT_KEY,
  WebSocketTransport,
  WebSocketTransportOptions,
} from '@electricui/transport-node-websocket'

import { BinaryLargePacketHandlerPipeline } from '@electricui/protocol-binary-large-packet-handler'
import { COBSPipeline } from '@electricui/protocol-binary-cobs'
import { HeartbeatConnectionMetadataReporter } from '@electricui/protocol-binary-heartbeats'
import WebSocket from 'ws'
import { customCodecs } from './codecs'
import { defaultCodecList } from '@electricui/protocol-binary-codecs'
import { typeCache } from './typeCache'

// Websockets
const wsTransportFactory = new TransportFactory(options => {
  const connectionInterface = new ConnectionInterface()

  const transport = new WebSocketTransport(options)

  const deliverabilityManager = new DeliverabilityManagerBinaryProtocol({
    connectionInterface,
    timeout: 3000,
  })

  const queryManager = new QueryManagerBinaryProtocol({
    connectionInterface,
  })

  const cobsPipeline = new COBSPipeline()
  const binaryPipeline = new BinaryPipeline()
  const typeCachePipeline = new BinaryTypeCachePipeline(typeCache)

  // If you have runtime generated messageIDs, add them as an array as a second argument
  // `name` is added because it is requested by the metadata requester before handshake.
  const undefinedMessageIDGuard = new UndefinedMessageIDGuardPipeline(typeCache, ['name', 'ws'])

  const codecPipeline = new CodecDuplexPipeline({ errorIfNoMatch: true })
  // Add the default codecs first so that queries are dealt with preferentially
  codecPipeline.addCodecs(defaultCodecList)
  // Add custom codecs after the default ones.
  codecPipeline.addCodecs(customCodecs)

  const largePacketPipeline = new BinaryLargePacketHandlerPipeline({
    connectionInterface,
    maxPayloadLength: 100,
  })

  const connectionStaticMetadata = new ConnectionStaticMetadataReporter({
    name: 'WebSockets',
    uri: options.uri,
  })

  const heartbeatMetadata = new HeartbeatConnectionMetadataReporter({
    interval: 1000,
    timeout: 3000,
    startupSequence: [0, 2000, 5000],
    // measurePipeline: true,
  })

  connectionInterface.setTransport(transport)
  connectionInterface.setQueryManager(queryManager)
  connectionInterface.setDeliverabilityManager(deliverabilityManager)
  connectionInterface.setPipelines([
    cobsPipeline,
    binaryPipeline,
    largePacketPipeline,
    codecPipeline,
    typeCachePipeline,
    undefinedMessageIDGuard,
  ])
  connectionInterface.addMetadataReporters([connectionStaticMetadata, heartbeatMetadata])

  return connectionInterface.finalise()
})

const wsConsumer = new DiscoveryHintConsumer({
  factory: wsTransportFactory,
  canConsume: (hint: Hint) => {
    if (hint.getTransportKey() === WEBSOCKETS_TRANSPORT_KEY) {
      // If you wanted to filter for specific serial devices, you would modify this section, removing the
      // return statement below and uncommenting the block below it, modifying it to your needs.
      const identification = hint.getIdentification()

      return true

      // return (
      //   identification.comPath.includes('serial') ||
      //   (identification.manufacturer &&
      //     (identification.manufacturer.includes('Arduino') ||
      //       identification.manufacturer.includes('Silicon')))
      // )
    }
    return false
  },
  configure: (hint: Hint) => {
    const identification = hint.getIdentification()
    const configuration = hint.getConfiguration()

    const options: WebSocketTransportOptions = {
      WebSocket,
      uri: identification.uri,
    }
    return options
  },
})

export { wsConsumer }
