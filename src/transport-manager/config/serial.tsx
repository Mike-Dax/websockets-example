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
  SERIAL_TRANSPORT_KEY,
  SerialPortHintProducer,
  SerialPortUSBHintTransformer,
  SerialTransport,
  SerialTransportOptions,
  SerialPortHintConfiguration,
  SerialPortHintIdentification,
} from '@electricui/transport-node-serial'
import SerialPort, { OpenOptions, SetOptions } from 'serialport'

import { BinaryLargePacketHandlerPipeline } from '@electricui/protocol-binary-large-packet-handler'
import { COBSPipeline } from '@electricui/protocol-binary-cobs'
import { HeartbeatConnectionMetadataReporter } from '@electricui/protocol-binary-heartbeats'
import USB from '@electricui/node-usb'
import { USBHintProducer } from '@electricui/transport-node-usb-discovery'
import { customCodecs } from './codecs'
import { defaultCodecList } from '@electricui/protocol-binary-codecs'
import { typeCache } from './typeCache'

const serialProducer = new SerialPortHintProducer({
  SerialPort,
  baudRate: 115200,
})

const usbProducer = new USBHintProducer({
  USB,
})

// Serial Ports
const serialTransportFactory = new TransportFactory(
  (options: SerialTransportOptions) => {
    const connectionInterface = new ConnectionInterface()

    const transport = new SerialTransport(options)

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
    const undefinedMessageIDGuard = new UndefinedMessageIDGuardPipeline(
      typeCache,
      ['name', 'ws'],
    )

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
      name: 'Serial',
      baudRate: options.baudRate,
    })

    const heartbeatMetadata = new HeartbeatConnectionMetadataReporter({
      interval: 500,
      timeout: 1000,
      startupSequence: [0, 2000, 2500, 3000, 4000, 5000],
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
    connectionInterface.addMetadataReporters([
      connectionStaticMetadata,
      heartbeatMetadata,
    ])

    return connectionInterface.finalise()
  },
)

const serialConsumer = new DiscoveryHintConsumer({
  factory: serialTransportFactory,
  canConsume: (
    hint: Hint<SerialPortHintIdentification, SerialPortHintConfiguration>,
  ) => {
    if (hint.getTransportKey() === SERIAL_TRANSPORT_KEY) {
      // If you wanted to filter for specific serial devices, you would modify this section, removing the
      // return statement below and uncommenting the block below it, modifying it to your needs.
      const identification = hint.getIdentification()

      // Don't use the bluetooth device on MacOS
      if (identification.comPath.includes('Bluetooth')) {
        return false
      }

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
  configure: (
    hint: Hint<SerialPortHintIdentification, SerialPortHintConfiguration>,
  ) => {
    const identification = hint.getIdentification()
    const configuration = hint.getConfiguration()

    const options: SerialTransportOptions = {
      SerialPort,
      comPath: identification.comPath,
      baudRate: configuration.baudRate,
      // attachmentDelay: 2000, // if you have an arduino that resets on connection, set this to 2000.
    }
    return options
  },
})

const usbToSerialTransformer = new SerialPortUSBHintTransformer({
  producer: serialProducer,
})

export { serialConsumer, serialProducer, usbProducer, usbToSerialTransformer }
