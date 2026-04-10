'use client';

import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface NetworkMapProps {
    initialNodes: any[];
    initialEdges: any[];
}

export default function NetworkMap({ initialNodes, initialEdges }: NetworkMapProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    React.useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    const onConnect = useCallback(
        (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    return (
        <div className="w-full h-full" style={{ backgroundColor: '#060a11' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                colorMode="dark"
                proOptions={{ hideAttribution: true }}
            >
                <Controls className="fill-white bg-white/5 border border-white/10" />
                <MiniMap 
                    nodeStrokeColor={(n) => {
                        if (n.type === 'input') return '#0041d0';
                        if (n.type === 'output') return '#ff0072';
                        if (n.type === 'default') return '#1a192b';
                        return '#eee';
                    }}
                    nodeColor={(n) => {
                        if (n.id.startsWith('router-')) return '#1e3a8a';
                        return '#000000';
                    }}
                    nodeBorderRadius={2}
                    className="bg-black/50 border border-white/10"
                    maskColor="rgba(0,0,0,0.5)"
                />
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.1)" />
            </ReactFlow>
        </div>
    );
}
