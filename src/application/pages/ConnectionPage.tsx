import {
  Button,
  Card,
  ControlGroup,
  FormGroup,
  InputGroup,
  ProgressBar,
  Classes,
} from '@blueprintjs/core'

import { Link, RouteComponentProps } from '@reach/router'
import { CancellationToken, Hint } from '@electricui/core'

import { Connections } from '@electricui/components-desktop-blueprint'
import { Logo } from '../components/Logo'
import { navigate } from '@electricui/utility-electron'
import React, { useCallback, useState } from 'react'
import {
  useDeviceHandshakeProgressIDs,
  useDeviceHandshakeProgress,
  useDeviceHandshakeState,
  useDeviceMetadataKey,
  useProduceHint,
} from '@electricui/components-core'
import { WEBSOCKETS_TRANSPORT_KEY } from '@electricui/transport-node-websocket'

const CardInternals = () => {
  const metadataName = useDeviceMetadataKey('name') || 'No name'

  return (
    <React.Fragment>
      <h3 className={Classes.HEADING}>{metadataName}</h3>
      <p>Device information!</p>
    </React.Fragment>
  )
}

function WebsocketForm() {
  const [uri, setUri] = useState('')
  const sendHint = useProduceHint()

  const search = useCallback(() => {
    const hint = new Hint(WEBSOCKETS_TRANSPORT_KEY)
    hint.setAvailabilityHint()
    hint.setIdentification({
      uri,
    })

    const cancellationToken = new CancellationToken()

    cancellationToken.deadline(10_000)

    console.log('sending hint', hint)

    const hintPromise = (sendHint(
      hint,
      cancellationToken,
    ) as Promise<string>).catch(err => {
      if (cancellationToken.caused(err)) {
        return
      }

      console.warn("Couldn't send hint to device manager", err)
    })
  }, [uri, sendHint])

  return (
    <>
      <FormGroup
        helperText="If you know the websockets address, you can type it here"
        label="Websockets URI"
        labelFor="text-input"
      >
        <ControlGroup fill>
          <InputGroup
            leftIcon="ip-address"
            onChange={(event: React.FormEvent<HTMLInputElement>) =>
              setUri(event.currentTarget.value)
            }
            placeholder="ws://255.255.255.255:80/ws"
            value={uri}
          ></InputGroup>
          <Button intent="success" onClick={search}>
            Search
          </Button>
        </ControlGroup>
      </FormGroup>
    </>
  )
}

export const ConnectionPage = (props: RouteComponentProps) => {
  return (
    <React.Fragment>
      <div style={{ height: '100vh' }}>
        <Logo />

        <Connections
          preConnect={deviceID => navigate(`/device_loading/${deviceID}`)}
          postHandshake={deviceID =>
            deviceID.includes('xbox')
              ? navigate(`/xbox/${deviceID}`)
              : navigate(`/devices/${deviceID}`)
          }
          onFailure={(deviceID, err) => {
            console.log('Connections component got error', err, deviceID)
            navigate(`/`)
          }}
          style={{
            minHeight: '40vh',
            paddingTop: '10vh',
          }}
          internalCardComponent={<CardInternals />}
        />
      </div>
    </React.Fragment>
  )
}
