import React, { useEffect, useState } from 'react'
import cs from 'classnames'
import styles from './index.module.css'
import { truncateString } from '../../../shared/utils/truncateString'
import { useAdminContext } from '@/context/AdminProvider'
import AdminActions from '../../Admin'
import Copy from '../../Copy'
import { NodeDataType } from '@Types/dataTypes'
import SupportedStorage from './SupportedStorage'
import NodePlatform from './NodePlatform'
import { useParams } from 'next/navigation'
import { Data } from '../../Table/data'

export default function Dashboard() {
  const params = useParams()
  // const { nodeId } = params
  console.log('🚀 ~ Dashboard ~ id:', params?.id)
  const [data, setData] = useState<NodeDataType>()
  const [, setLoading] = useState(true)
  const [, setIpAddress] = useState('')
  const { setAllAdmins, setNetworks } = useAdminContext()

  const filteredNodeData = Data.find((node) => node.nodeId === params?.id)
  console.log('🚀 ~ Dashboard ~ getNodeMockData:', filteredNodeData)

  useEffect(() => {
    setLoading(true)
    try {
      const apiUrl = '/directCommand'
      fetch(apiUrl, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          command: 'status'
        })
      })
        .then((res) => res.json())
        .then((data) => {
          setData(data)
          setAllAdmins(data.allowedAdmins)
          setNetworks(data.indexer)
          setLoading(false)
        })
    } catch (error) {
      setLoading(false)
      console.error('error', error)
    }
  }, [])

  useEffect(() => {
    // Fetch the IP address
    fetch('https://api.ipify.org?format=json')
      .then((res) => res.json())
      .then((data) => {
        setIpAddress(data.ip)
      })
      .catch((error) => {
        console.error('Failed to fetch IP address:', error)
      })
  }, [])

  const nodeData = [
    {
      id: filteredNodeData?.nodeId,
      ip: filteredNodeData?.ipAddress,
      indexerData: data?.indexer
    }
  ]

  const arrayOfPlatformObjects: { key: string; value: string | number }[] = []

  filteredNodeData &&
    Object.keys(filteredNodeData?.platform).forEach((key) => {
      const obj = {
        key,
        // @ts-expect-error - error is shown here because the key is used as an index.
        value: filteredNodeData?.platform[key]
      }

      arrayOfPlatformObjects.push(obj)
    })

  const ConnectionDetails = () => {
    return (
      <div>
        <div className={styles.title29}>NETWORK</div>
        <div className={styles.details}>
          <div className={styles.details}>
            <div className={styles.columnP2P}>
              <div className={cs([styles.title24, styles.borderBottom])}>
                P2P - {filteredNodeData?.nodeDetails.P2P ? 'UP' : 'DOWN'}
              </div>
              <div className={styles.nodes}>
                <div className={styles.title24}>NODE ID</div>
                {nodeData.map((node) => {
                  return (
                    <div className={styles.node} key={node.id}>
                      <div className={styles.nodeAddress}>
                        <div className={styles.node}>{truncateString(node.id, 12)}</div>
                      </div>
                      <Copy text={node?.id as string} />
                    </div>
                  )
                })}
              </div>
              <div className={styles.nodes}>
                <div className={styles.title24}>Location</div>
                <div className={styles.node}>{filteredNodeData?.location}</div>
                <div className={styles.title24}>City</div>
                <div className={styles.node}>{filteredNodeData?.nodeDetails.city}</div>
                <div className={styles.title24}>Address</div>
                <div className={styles.node}>
                  {filteredNodeData?.ipAddress}
                  <Copy text={filteredNodeData?.ipAddress as string} />
                </div>
              </div>
              {/* <NodePeers /> */}
            </div>
            <div className={styles.columnHTTP}>
              <div className={cs([styles.title24, styles.borderBottom])}>
                HTTP - {filteredNodeData?.nodeDetails.Http ? 'UP' : 'DOWN'}
              </div>
              {/* <div className={styles.nodes}>
                <div className={styles.nodeAddress}>
                  <h5 className={styles.title24}>IP : </h5>
                  <div className={styles.nodeAddress}>{filteredNodeData?.ipAddress}</div>
                  <Copy text={filteredNodeData?.ipAddress as string} />
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <AdminActions />

      <div className={styles.bodyContainer}>
        {/* {filteredNodeData ? (
          <div className={styles.loaderContainer}>
            <Spinner />
          </div>
        ) : ( */}
        <div className={styles.body}>
          <ConnectionDetails />
          {/* <Indexer data={data} /> */}
          <SupportedStorage data={filteredNodeData?.supportedStorage} />
          {/* <AdminAccounts /> */}
          <NodePlatform platformData={arrayOfPlatformObjects} />
        </div>
        {/* )} */}
      </div>
    </div>
  )
}
